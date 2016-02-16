// willy-bot: like wally and welly, the next-gen
// Copyright (C) 2015 - 2016  David Ulrich
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

/* jshint latedef: nofunc */

var
	_          = require("lodash"),
	A          = require("async"),
	irc        = require("irc"),
	moment     = require("moment"),
	mysql      = require("mysql"),
	num_to_str = require("./number_to_string.js"),
	request    = require("request");

require("./fn.js")(global);

var config = require("./config.json");

config.regex_command = new RegExp("^"+config.name+"\\b","i");
config.bored_timeout = int(config.bored_timeout) || 5 * 60; // seconds
config.quiet_time = int(config.quiet_time) || 5;
config.verbosity = config.verbosity || 1.0;
config.version = U("%s-bot-1.5.0",config.name);

var question_answers = {};

var client;

var message_log = [];

var state = {
	last_action     : "",
	last_message    : "",
	last_pattern    : null,
	last_repeat     : "",
	last_boredcheck : moment(),
	last_evtime     : moment(),
	last_acttime    : moment(),
	next_rand       : null,
	quiet_time      : {}
};

var db;
function init_db() {
	return mysql.createConnection({
		host        : config.db_host,
		database    : config.db_name,
		user        : config.db_user,
		password    : config.db_pass,
		dateStrings : true
	});
}

db = init_db();

db.on("error",function(err) {
	if (err.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR") {
		err.fatal = true;
	}
	
	if (!err.fatal) return;
	
	if (db) db.end();
	db = init_db();
});

var lists = {
	nick : []
};
var lists_regex = {};
var meta_lists = {
	bored   : [],
	nick    : [],
	nothing : [],
	repeat  : [],
	secret  : []
};

var pattern_list,pattern_map;

pattern_list = [];
pattern_map = {};

var nick_pattern_index = -1;

function load_lists(acb) {
	var query_lists = "SELECT \
			L.ListName, \
			I.ItemText \
		FROM wb_item I \
		LEFT JOIN wb_list L ON I.ListID = L.ListID \
		WHERE NOT I._deleted \
			AND NOT L._deleted";

	query(db,query_lists,function(err,res) {
		var list_pattern;
		
		if (err) return acb("ERROR: failed to load replacement lists",err);
		
		_.each(res,function(row) {
			lists[row.ListName] = lists[row.ListName] || [];
			
			lists[row.ListName].push(row.ItemText);
		});
		
		list_pattern = _.map(lists,function(list,name) {
			return name;
		}).join("|");
		
		pattern_list.push({
			trigger : "builtin: <list name> reply <list item>",
			builtin : true,
			pattern : new RegExp("\\b("+list_pattern+")\\b","i"),
			reply   : [
				"actually, ?rand_?match",
				"?match, you mean like ?rand_?match...?",
				"?rand_?match!!!",
				"?crand_?match!!!",
				"?indef_?match!!!",
				"?cindef_?match!!!",
				"?multi_?match!!!",
				"?cmulti_?match!!!",
				"uhh, maybe ?rand_?match?",
				"uhh, maybe ?multi_?match?"
			]
		});
		
		acb(null);
	});
}

function load_meta(acb) {
	var query_meta = "SELECT \
			L.MetaListName, \
			R.MetaReply \
		FROM wb_meta_item R \
		LEFT JOIN wb_meta_list L ON R.MetaListID = L.MetaListID \
		WHERE NOT R._deleted \
			AND NOT L._deleted";

	query(db,query_meta,function(err,res) {
		if (err) return acb("ERROR: failed to load meta lists",err);
		
		_.each(res,function(row) {
			if (!meta_lists[row.MetaListName]) return;
			
			meta_lists[row.MetaListName].push(row.MetaReply);
		});
		
		acb(null);
	});
}

function create_pattern(pattern,reply,nick) {
	var index,raw;
	
	raw = pattern;
	
	pattern_map[raw] = pattern_map[raw] || pattern_list.length;
	
	index = pattern_map[raw];
	
	pattern = raw.replace(/%(\w+)%/g,function(match,list) {
		log(match);
		
		if (isndef(lists[list])) return match[0];
		
		lists_regex[list] = lists_regex[list] || lists[list].join("|");
		
		return U("(%s)",lists_regex[list]);
	});
	
	pattern_list[index] = pattern_list[index] || {
		trigger : raw,
		pattern : new RegExp("\\b"+pattern+"\\b","i"),
		reply   : [],
		nick    : nick
	};
	
	pattern_list[index].reply.push(reply);
}

function load_patterns(acb) {
	var query_patterns = "SELECT \
			P.* \
		FROM wb_pattern P \
		WHERE NOT P._deleted \
		ORDER BY P.PatternPriority DESC,P.PatternRegExp,P.PatternReply";
	
	query(db,query_patterns,function(err,res) {
		if (err) return acb("ERROR: failed to load patterns",err);
		
		_.each(res,function(row) {
			create_pattern(
				row.PatternRegExp,
				row.PatternReply,
				row.PatternNick
			);
		});
		
		acb(null);
	});
}

function load_answers(acb) {
	var query_answers = "SELECT \
			L.AnswerListName, \
			A.AnswerReply \
		FROM wb_answer_item A \
		LEFT JOIN wb_answer_list L ON A.AnswerListID = L.AnswerListID \
		WHERE NOT A._deleted \
			AND NOT L._deleted";
	
	query(db,query_answers,function(err,res) {
		if (err) return acb("ERROR: failed to load answers",err);
		
		_.each(res,function(row) {
			if (!question_answers[row.AnswerListName]) {
				question_answers[row.AnswerListName] = [];
			}
			
			question_answers[row.AnswerListName].push(row.AnswerReply);
		});
		
		help.question.notes.push(U(
			"* <type> is %s",_.keys(question_answers).join("|")
		));
		
		acb(null);
	});
}


A.parallel([
	load_lists,
	load_meta,
	load_patterns,
	load_answers
],function(err) {
	if (err) return log(err);
	
	client = new irc.Client(config.server,config.name,{
		// sasl : true,
		// port : 6697,
		// userName : ,
		// password : ,
		
		channels : config.channels,
		floodProtection : true,
		floodProtectionDelay : 500,
		
		realName : config.realName || "unknown",
		userName : config.userName || "unknown"
	});
	
	bot_init();
});


function randish_el(list) {
	var min,max;
	
	min = 0;
	max = list.length - 1;
	
	if (state.next_rand !== null) {
		if (state.next_rand < min) {
			max = min;
		}
		
		if (state.next_rand > max) {
			min = max;
		}
		
		if (min !== max) {
			min = state.next_rand;
			max = state.next_rand;
		}
	}
	
	return list[rand(min,max)];
}

function replace_tokens(str,from,m_match) {
	var out,rx_int;
	
	out = str;
	
	_.each(question_answers,function(list,name) {
		var rx_plain;
		
		rx_plain = new RegExp("\\\?rand_q_"+name+"\\b","i");
		
		while(out.match(rx_plain)) {
			out = out.replace(rx_plain,randish_el(list));
		}
	});
	
	out = out.replace(/\?from\b/g,from);
	out = out.replace(/\?match0?\b/g,(m_match && m_match[0]) || "");
	out = out.replace(/\?match1\b/g,(m_match && m_match[1]) || "");
	out = out.replace(/\?match2\b/g,(m_match && m_match[2]) || "");
	out = out.replace(/\?match3\b/g,(m_match && m_match[3]) || "");
	
	rx_int = /\?(t)?rand_(int|eighth)([\d_]+)?/gi;
	out = out.replace(rx_int,function(match,text,type,range) {
		var min,max;
		
		min = string(range).split("_")[0];
		max = string(range).split("_")[1];
		
		if (!max) {
			if (!min) min = 100;
			
			max = min;
			min = 0;
		}
		
		min = int(min);
		max = int(max);
		
		if (type === "eighth") {
			return eighth(rand(min,max) / 8);
		}
		else if (text === "t") {
			return num_to_str(rand(min,max));
		}
		else {
			return rand(min,max);
		}
	});
	
	_.each(lists,function(list,name) {
		var diff_list,rx_diff,rx_indef,rx_multi,rx_plain,rx_posses;
		
		rx_diff   = new RegExp("\\\?(c?)diff_"+name+"\\b(~[a-z]){0,}","gi");
		rx_indef  = new RegExp("\\\?(c?)indef_"+name+"\\b(~[a-z]){0,}","gi");
		rx_multi  = new RegExp("\\\?(c?)multi_"+name+"\\b(~[a-z]){0,}","gi");
		rx_plain  = new RegExp("\\\?(c?)rand_"+name+"\\b(~[a-z]){0,}","gi");
		rx_posses = new RegExp("\\\?(c?)posses_"+name+"\\b(~[a-z]){0,}","gi");
		
		diff_list = _.clone(list);
		
		out = out.replace(rx_diff,function(match,caps,tags) {
			var val;
			
			if (diff_list.length) {
				val = randish_el(diff_list);
				diff_list = _.without(diff_list,val);
			}
			else {
				val = randish_el(list);
			}
			
			if (caps) val = upperCase(val);
			
			return val;
		});
		
		out = out.replace(rx_indef,function(match,caps,tags) {
			var val;
			
			val = randish_el(list);
			
			if (caps) val = upperCase(val);
			
			val = val.match(/^[aeiou]/i)
				? "an " + val
				: "a " + val;
			
			return val;
		});
		
		out = out.replace(rx_multi,function(match,caps,tags) {
			var val;
			
			val = randish_el(list);
			
			if (caps) val = upperCase(val);
			
			val = val.replace(/([^aeiou])y$/i,"$1ies");
			val = val.replace(/sh$/i,"shes");
			val = val.replace(/ife$/i,"ives");
			val = val.replace(/([^s])$/i,"$1s");
			
			return val;
		});
		
		out = out.replace(rx_plain,function(match,caps,tags) {
			var val;
			
			val = randish_el(list);
			
			if (caps) val = upperCase(val);
			
			return val;
		});
		
		out = out.replace(rx_posses,function(match,caps,tags) {
			var val;
			
			val = randish_el(list);
			
			if (caps) val = upperCase(val);
			
			val = val.replace(/s$/i,"s'");
			val = val.replace(/([^s])$/i,"$1's");
			
			return val;
		});
	});
	
	out = out.replace(/\?(c)?or(_[^\s_]+)+/gi,function(match,caps) {
		var list,val;
		
		list = match.split("_");
		list.shift();
		
		if (list.length === 0) {
			return "";
		}
		
		val = randish_el(list);
		
		if (caps) val = upperCase(val);
		
		return val;
	});
	
	out = out.replace(/\?version\b/g,config.version);
	
	if (config.mode == "ye olde englishe") {
		_.each(ye_olde_words,function(pair,i) {
			if (isarray(pair)) {
				ye_olde_words[i] = {
					new    : pair[0],
					olde   : pair[1],
					regexp : new RegExp("\\b"+pair[0]+"\\b","gi")
				};
			}
			
			out = out.replace(pair.regexp,pair.olde);
		});
	}
	else if (config.mode === "l33t h4x0r") {
		_.each(l33t_h4x0r_w4rdz,function(pair,i) {
			if (isarray(pair)) {
				l33t_h4x0r_w4rdz[i] = {
					l33t   : pair[1],
					r3g3xp : new RegExp(pair[0],"gi")
				};
				
				pair = l33t_h4x0r_w4rdz[i];
			}
			
			out = out.replace(pair.r3g3xp,pair.l33t);
		});
	}
	else log("MODE config.mode");
	
	return out;
}

function send_raw(to,from,message,m_match,raw,trigger,verbosity) {
	var out;
	
	out = message;
	
	if (!raw) {
		out = replace_tokens(out,from,m_match);
	}
	
	if (Math.random() > Math.max(config.verbosity,float(verbosity))) {
		log("VERBOSITY LIMITED");
		return;
	}
	
	if (state.quiet_time[to] && moment().isBefore(state.quiet_time[to])) {
		log("QUIET TIME");
		return;
	}
	
	if (out.match(/^\/me\s+/)) {
		client.action(to,out.replace(/^\/me\s+/,""));
	}
	else if (out) {
		client.say(to,out);
	}
	else {
		return;
	}
	
	log("ISAID: " + out);
	
	state.last_acttime = moment();
	if (!raw && state.next_rand !== null) {
		log(U("UNSET RAND %s",state.next_rand));
		state.next_rand = null;
	}
	
	message_log.push({
		to      : to,
		from    : from,
		message : message,
		real    : out,
		raw     : raw,
		time    : moment(),
		trigger : trigger
	});
}

function send(to,from,message,m_match,trigger,verbosity) {
	var raw;
	
	message = string(message);
	
	raw = false;
	if (message.match(/^\/raw\s+/i)) {
		message = message.replace(/^\/raw\s+/i,"");
		raw = true;
	}
	
	send_raw(to,from,message,m_match,raw,trigger,verbosity);
}

function act_bored() {
	if (state.last_evtime.isAfter(state.last_boredcheck)) {
		state.last_boredcheck = moment();
		return; // wait at least config.bored_timeout
	}
	
	state.last_boredcheck = moment();
	
	if (state.last_evtime.isBefore(state.last_acttime)) return; // don't spam empty channel
	
	send(config.channels[0],"",rand_el(meta_lists.bored),"","builtin: y'all are boring");
}

setInterval(act_bored,config.bored_timeout * 1000);

var action_modifiers = [
	"too",
	"with ?from",
	"with ?indef_noun",
	"better than ?from"
];

var l33t_h4x0r_w4rdz = [
	["\\b(too|to|two)\\b","2"],
	["\\b([b-df-hj-np-tv-z])ate\\b","$18"],
	["you","u"],
	["oh","o"],
	["aa","44"],
	["ee","33"],
	["ii","11"],
	["oo","00"],
	["tt","77"],
	["t","7"],
	["([^aeiou])a([b-df-hj-np-tv-z])","$14$2"],
	["([^aeiou])e([b-df-hj-np-tv-z])","$13$2"],
	["([^aeiou])i([b-df-hj-np-tv-z])","$11$2"],
	["([^aeiou])o([b-df-hj-np-tv-z])","$10$2"],
	["([b-df-hj-np-tv-z])a([^aeiou])","$14$2"],
	["([b-df-hj-np-tv-z])e([^aeiou])","$13$2"],
	["([b-df-hj-np-tv-z])i([^aeiou])","$11$2"],
	["([b-df-hj-np-tv-z])o([^aeiou])","$10$2"],
	["[s]+\\b","z"],
	["\\bb","8"],
	["/m3","/me"]
];

var ye_olde_words = [
	["are","art"],
	["you do","you dost"],
	["do you","dost you"],
	["does","dost"],
	["here","hither"],
	["has","hath"],
	["had","hadst"],
	["was","wast"],
	["none","naught"],
	["null","naught"],
	["nil","naught"],
	["will","shalt"],
	["you","thou"],
	["you","thee"],
	["your","thine"],
	["your","thy"],
	["there","thither"],
	["think","trow"],
	["where","whiter"],
	["(\\w+)([aeiou])([dkpt])","$1$2$3e"],
	["(\\w+)([^aeiou][dkp]|sh|[^s]t)","$1$2e"],
	["(\\w+)own","$1ewn"],
	["the","ye olde"]
];

var help = require("./help.json");

var command_list = [{
	trigger   : U("command: %s.",help.help.syntax),
	pattern   : /^help(\s+\w+)?$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var match,name,reply,rx_match;
		
		rx_match = /^help\s+(\w+)?$/i;
		match = rx_match.exec(input);
		
		name = string(match && match[1]);
		
		reply = [];
		
		if (name) {
			if (!help[name]) {
				reply.push("?from: do you know how to type? " + name + " isn't a command");
			}
			else {
				reply.push(U("%s: %s",name,help[name].use));
				reply.push(U("%s syntax: %s",name,help[name].syntax));
				
				if (help[name].notes) reply.push(help[name].notes);
			}
		}
		else {
			reply.push("AVAILABLE COMMANDS:");
			reply.push(_.chain(help).map(function(item,name) {
				return name;
			}).sortBy().join(", ").value());
		}
		
		_.chain(reply).flatten().each(function(line) {
			send(to,from,line,input,U("command: %s",help.help.syntax),1);
		}).value();
		
		return "if that doesn't help you, then nothing can";
	}
},
{
	trigger   : U("command: %s.",help.listsearch.syntax),
	pattern   : /^listsearch (\w+)$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var out,term;
		
		term = input.split(" ")[1];
		
		out = [];
		
		_.each(lists,function(list,name) {
			if (name.indexOf(term) !== -1) {
				out.push(U("list name: %s",name));
			}
			
			_.each(list,function(item) {
				if (item.indexOf(term) !== -1) {
					out.push(U("%s term: %s",name,item));
				}
			});
		});
		
		return out;
	}
},
{
	trigger   : U("command: %s.",help.listsearch.syntax),
	pattern   : /^listsearch/i,
	verbosity : 1,
	reply     : "that's not a valid search term"
},
{
	trigger   : U("command: %s.",help.listshow.syntax),
	pattern   : /^listshow$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var out;
		
		out = _.map(lists,function(list,name) {
			return U("%s: %d",name,list.length);
		}).join(", ");
		
		return out;
	}
},
{
	trigger   : U("command: %s.",help.listshow.syntax),
	pattern   : /^listshow \w+$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var list,out;
		
		list = input.split(" ")[1];
		
		if (!lists[list]) return "?from: that's not a valid list";
		
		out = _.map(lists[list],function(item) {
			return U("%s",item);
		}).join(", ");
		
		return out;
	}
},
{
	trigger   : U("command: %s.",help.listcreate.syntax),
	pattern   : /^listcreate \w+$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var list,query_list;
		
		list = input.split(" ")[1];
		
		if (list.length > 8) {
			return "?from: stop trying to waste space with those long list names";
		}
		
		if (lists[list]) {
			return "?from: that list already exists; do i look like your ?rand_person?";
		}
		
		query_list = "INSERT IGNORE INTO wb_list \
			SET ListName = ?list";
		
		query(db,{
			query : query_list,
			param : { list : list }
		},function(err,res) {
			if (err) return log("FAILED TO START LIST :" + list,err);
			
			log("STARTED LIST: " + list);
			lists[list] = [];
		});
		
		return "?from: ?rand_assent";
	}
},
{
	trigger   : "random joke from icndb.com/api",
	pattern   : /^(tell a )?joke$/,
	verbosity : 1,
	reply     : function(from,to,input) {
		var name = rand_el([from].concat(lists.nick));
		
		request({
			uri : "http://api.icndb.com/jokes/random",
			qs  : {
				escape    : "javascript",
				firstName : name,
				lastName  : name
			}
		},function(err,obj,res) {
			var msg;
			
			if (err) return log(err);
			
			try {
				res = JSON.parse(res);
			}
			catch (e) {
				res = null;
				log(e);
			}
			
			msg = res && res.value && res.value.joke || "";
			
			if (!msg) return;
			
			msg = msg
				.replace(new RegExp(U("%s %s'",name,name),"g"),U("%s's",name))
				.replace(new RegExp(U("%s %s",name,name),"g"),name)
				.replace(new RegExp(U("%s%s",name,name),"g"),name);
			
			send(to,from,msg,"",false,"random joke from icndb.com/api",1);
		});
		
		return "";
	}
},
{
	trigger   : U("command: %s.",help.match.syntax),
	pattern   : /^match \/.+\/ reply .+$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var match,param_pattern,pattern,query_pattern,reply,rx_match;
		
		rx_match = /^match \/(.+)\/ reply (.+)$/i;
		
		match = rx_match.exec(input);
		
		if (!match || !match[1] || !match[2]) {
			return "?from: sorry, your pattern is invalid";
		}
		
		pattern = match[1];
		reply   = match[2];
		
		if (
			pattern_map[pattern]
			&& _.contains(pattern_list[pattern_map[pattern]].reply)
		) {
			return U("?from: i already match that pattern");
		}
		
		param_pattern = {
			from    : from,
			pattern : pattern,
			reply   : reply
		};
		
		query_pattern = "INSERT IGNORE INTO wb_pattern \
			SET PatternMode = 'word', \
				PatternRegExp = ?pattern, \
				PatternReply = ?reply, \
				PatternNick = ?from";
		
		query(db,{
			query : query_pattern,
			param : param_pattern
		},function(err,res) {
			if (err) return log("FAILED TO SAVE PATTERN:" + pattern,err);
			
			log("ADDED PATTERN: " + pattern);
			create_pattern(pattern,reply,from);
		});
		
		return "?from: ?rand_assent";
	}
},
{
	trigger   : U("command: %s.",help.question.syntax),
	pattern   : /^question \w+ reply .+$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var match,param_answer,query_answer,reply,rx_match,list;
		
		rx_match = /^question (\w+) reply (.+)$/i;
		
		match = rx_match.exec(input);
		
		if (!match || !match[1] || !match[2]) {
			return "?from: sorry, your answer is invalid";
		}
		
		list  = match[1];
		reply = match[2];
		
		if (!question_answers[list])
		
		if (_.contains(question_answers[list],reply)) {
			return U("?from: i already match that pattern");
		}
		
		param_answer = {
			from  : from,
			reply : reply,
			list  : list
		};
		
		query_answer = "INSERT IGNORE INTO wb_answer_item \
			SET AnswerReply = ?reply, \
				AnswerNick = ?from, \
				AnswerListID = (\
				SELECT AnswerListID FROM wb_answer_list WHERE AnswerListName = ?list)";
		
		query(db,{
			query : query_answer,
			param : param_answer
		},function(err,res) {
			if (err) return log("FAILED TO SAVE ANSWER:" + reply,err);
			
			log("ADDED ANSWER: " + reply);
			question_answers[list].push(reply);
		});
		
		return "?from: ?rand_assent";
	}
},
{
	trigger   : U("command: %s.",help.meta.syntax),
	pattern   : /^if (bored|nick|nothing|repeat|secret) reply (.+)$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var match,meta,param_meta,query_meta,reply,rx_match;
		
		rx_match = /^if (bored|nick|nothing|repeat|secret) reply (.+)$/i;
		
		match = rx_match.exec(input);
		
		if (!match || !match[1] || !match[2]) {
			return "?from: sorry, you are not meta enough for that";
		}
		
		meta    = match[1];
		reply   = match[2];
		
		if (_.contains(meta_lists[meta],reply)) {
			return U("?from: i already reply that for %s",meta);
		}
		
		param_meta = {
			from  : from,
			meta  : meta,
			reply : reply
		};
		
		query_meta = "INSERT IGNORE INTO wb_meta_item \
			SET MetaReply = ?reply,\
				MetaListID = (\
				SELECT MetaListID FROM wb_meta_list WHERE MetaListName = ?meta)";
		
		query(db,{
			query : query_meta,
			param : param_meta
		},function(err,res) {
			if (err) return log("FAILED TO SAVE REPLY:" + reply,err);
			
			log(U("ADDED REPLY: %s => %s",meta,reply));
			
			meta_lists[meta].push(reply);
		});
		
		return "?from: ?rand_assent";
	}
},
{
	trigger   : U("command: %s.",help.match.syntax),
	pattern   : /^match/i,
	verbosity : 1,
	reply     : ["?from, did you mean: " + help.match.syntax]
},
{
	trigger   : U("command: %s.",help.pattern.syntax),
	pattern   : /^pattern \w+$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var cmd,count_pattern,count_reply,patt_l,patt_s,stat_l,stat_s;
		
		cmd = input.split(" ")[1];
		
		count_pattern = pattern_list.length;
		count_reply = _.pluck(pattern_list,"reply").reduce(function(m,v) {
			return m + v.length;
		},0);
		
		patt_l = "";
		patt_s = "";
		
		stat_l = 0;
		stat_s = 0;
		
		_.each(pattern_list,function(pattern) {
			var len = pattern.builtin ? 0 : pattern.trigger.length;
			
			if (len > stat_l) {
				stat_l = len;
				patt_l = pattern.trigger;
			}
			
			if (!stat_s || len < stat_s) {
				stat_s = len;
				patt_s = pattern.trigger;
			}
		});
		
		if (cmd === "count") {
			return U("?from: i know responses to %d patterns",count_pattern);
		}
		else if (cmd == "longest") {
			return U("?from: the longest pattern is '%s' at %d characters",patt_l,stat_l);
		}
		else if (cmd === "replies") {
			return U("?from: i have %d replies",count_reply);
		}
		else if (cmd == "shortest") {
			return U("?from: the shortest pattern is '%s' at %d characters",patt_s,stat_s);
		}
		else if (cmd == "stats") {
			return U("?from: patterns have %s replies on average",fixed(safe_div(count_reply,count_pattern)));
		}
		
		return "?from: wtf are you talking about?";
	}
},
{
	trigger   : U("command: %s.",help.listadd.syntax),
	pattern   : /^listadd \w+\s+(\w+|"[^"]+")+/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var items,list,param_item,query_item;
		
		list = input.split(" ")[1];
		
		if (!lists[list]) {
			return "?from: sorry, that's not a valid list";
		}
		
		if (list === "nick") {
			return "?from: nick is a builtin list, you can't change it";
		}
		
		items = input.replace(/^listadd \w+\s+/i,"").match(/("[^"]+"|\w+)/g);
		
		if (!items || !items.length) return "uhhh... idk what happened";
		
		_.each(items,function(item) {
			item = item.replace(/"/g,"").replace(/^\s+/,"").replace(/\s+$/,"");
			
			if (_.contains(lists[list],item)) {
				return "?from: i already have that";
			}
			
			param_item = {
				item : item,
				list : list
			};
			
			query_item = "INSERT IGNORE INTO wb_item \
				SET ItemText = ?item,\
					ListID = (\
					SELECT ListID FROM wb_list WHERE ListName = ?list)";
			
			query(db,{
				query : query_item,
				param : param_item
			},function(err,res) {
				if (err) return log("FAILED TO ADD ITEM: " + list + ", " + item,err);
				
				log("ADDED LIST ITEM: " + list + ", " + item);
				lists[list].push(item);
			});
		});
		
		return "ok ?from, ?rand_assent";
	}
},
{
	trigger   : U("command: %s.",help.mode.syntax),
	pattern   : /^mode .+$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var mode;
		
		mode = input.split("mode ")[1];
		
		if (orin(mode,["ye olde englishe","l33t h4x0r","normal"])) {
			config.mode = mode;
			
			return U("entering %s mode",mode);
		}
		
		return "invalid mode, dipswitch";
	}
},
{
	trigger   : U("command: %s.",help.repeat.syntax),
	pattern   : /^repeat to (#\w+) message (.+)$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var channel,match,message;
		
		match = input.match(/^repeat to (#\w+) message (.+)$/i);
		
		if (!match || !match[1] || !match[2]) {
			return "?from: sorry, what?";
		}
		
		channel = match[1];
		message = match[2];
		
		if (!orin(channel,config.channels)) {
			return "from: i don't go there";
		}
		
		send(channel,from,message,input,"",1);
		
		return "";
	}
},
{
	trigger   : U("command: %s.",help.search.syntax),
	pattern   : /^search\s+.+/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var param,query_search,term,terms;
		
		term = input.replace(/^search\s+/i,"");
		terms = term.split(/ _-/);
		
		query_search = "SELECT * FROM wb_pattern WHERE NOT _deleted AND ( 0 ";
		
		param = {};
		_.each(terms,function(t,i) {
			query_search += " OR PatternRegExp LIKE ?term_"+i;
			query_search += " OR PatternReply LIKE ?term_"+i;
			param["term_" + i] = "%"+t+"%";
		});
		
		query_search += " ) ORDER BY RAND() LIMIT 0,3";
		
		query(db,{
			query : query_search,
			param : param
		},function(err,res) {
			if (err) return log("FAILED SEARCH: " + term,err);
			
			send(
				to,
				from,
				U("found %d patterns for %s",res.length,term),
				input,
				U("command: %s",help.search.syntax),
				1
			);
			
			_.each(res,function(row) {
				send_raw(
					to,
					from,
					U("%s: /%s/ reply %s",row.PatternNick,row.PatternRegExp,row.PatternReply),
					input,
					true,
					U("command: %s",help.search.syntax),
					1
				);
			});
		});
		
		return U("looking into %s for you",term);
	}
},
{
	trigger   : U("command: %s.","leave"),
	pattern   : /(get out|leave)/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var partings = [
			"ok ?from, i'm out",
			"/me ?rand_action",
			"/me hits the road"
		];
		
		delay(client.part,client,[to],100);
		
		return rand_el(partings);
	}
},
{
	trigger   : U("command: %s.",help.mute.syntax),
	pattern   : /^mute( \d+)?$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var length = int(input.split(" ")[1]) || config.mute_length;
		
		state.quiet_time[to] = moment().add(length,"minute");
		
		return "";
	}
},
{
	trigger   : U("command: %s.",help.unmute.syntax),
	pattern   : /^unmute$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		state.quiet_time[to] = moment();
		
		return "HI ?from!!!";
	}
},
{
	trigger   : U("command: %s.",help.verbosity.syntax),
	pattern   : /^verbosity \d.\d\d?$/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		config.verbosity = float(input.split(" ")[1]);
		
		return "?rand_assent";
	}
},
{
	trigger   : U("command: %s.",help.verbosity.syntax),
	pattern   : /^verbosity/i,
	verbosity : 1,
	reply     : "?from: i'll consider it if you give me a valid number"
},
{
	pattern   : /(go die|kill you)/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		delay(process.exit,null,[],100);
		
		return "/me commits suicide with ?indef_noun";
	}
},
{
	pattern   : /^(time|got the time\??|what time is it\??)/i,
	verbosity : 1,
	reply     : function(from,to,input) {
		var times = [
			"?from: it's " + moment().format("llll") + " here",
			"?from: tomorrow is " + moment().to(moment().endOf("day")),
			"?from: it's " + moment().valueOf() + "ms into the Unix Epoch"
		];
		
		return rand_el(times);
	}
},
{
	trigger   : U("command: %s.",help.version.syntax),
	pattern   : /(who are you|version)/i,
	verbosity : 1,
	reply     : [
		"?version at your service",
		"?version reporting for duty",
		"?version build ?rand_int100000_600000"
	]
},
{
	trigger   : U("command: %s.",help.rand.syntax),
	pattern   : /^(indef|multi|rand) \w+$/i,
	verbosity : 1,
	reply     : function(to,from,input) {
		var form,list;
		
		form = input.split(" ")[0];
		list = input.split(" ")[1];
		
		if (form === "rand" && list === "eighth") return "?rand_eighth1_16";
		else if (form === "rand" && list === "int") return "?rand_int1_100";
		
		if (!lists[list]) {
			return "tofu";
		}
		
		return U("?%s_%s",form,list);
	}
},
{
	trigger   : U("command: %s.",help.setrand.syntax),
	pattern   : /^setrand \d+$/,
	verbosity : 1,
	reply     : function(to,from,input) {
		var next_rand;
		
		next_rand = int(input.split(" ")[1]);
		
		state.next_rand = next_rand;
		log(U("SET RAND %s",state.next_rand));
		
		return U("/raw random number set to %d",next_rand);
	}
},
{
	trigger   : "meta-loop",
	pattern   : /^what was that\?/i,
	verbosity : 1,
	reply     : function(to,from,input) {
		var last;
		
		last = message_log[message_log.length - 1];
		
		if (!last || !last.trigger) {
			return rand_el(meta_lists.secret);
		}
		
		if (last.trigger == "meta-loop") {
			return "the inception has begun";
		}
		
		if (isstring(last.trigger) || last.trigger.builtin) {
			return U("that was %s",last.trigger.trigger || last.trigger);
		}
		
		return U("/raw that was %s: /%s/ reply %s",
			last.trigger.nick,
			last.trigger.trigger,
			last.trigger.reply);
	}
},
{
	pattern : /\bsudo\b/i,
	reply   : meta_lists.secret
},
{
	pattern : /^(tell|make)\s/i,
	verbosity : 1,
	reply   : function(from,to,input) {
		var match,out,rx;
		
		out = input;
		rx = /^(tell|make)\s+(\w+)(.+)?/i;
		
		match = rx.exec(input);
		
		if (match && match[1] && match[2]) {
			out = U(
				"/me %ss %s%s",
				match[1],
				(match[2].match(/^me/i) ? "?from" : match[2]),
				match[3] || ""
			);
		}
		
		return out;
	}
},
{
	pattern : /.+\?/i,
	reply   : function(from,to,input) {
		var answer;
		
		// who, what, where, why, when, how, how many|much
		answer = "?rand_q_prob";
		if (input.match(/\bwh?at\b/i)) {
			answer = "?rand_q_value";
		}
		else if (input.match(/\bwhen\b/i)) {
			answer = "?rand_q_time";
		}
		else if (input.match(/\bwhere\b/i)) {
			answer = "?rand_q_location";
		}
		else if (input.match(/\bwhy\b/i)) {
			answer = "?rand_q_reason";
		}
		else if (input.match(/\bwho\b/i)) {
			answer = "?rand_q_person";
		}
		
		return answer;
	}
},
{
	pattern : /.?/,
	reply   : meta_lists.nothing
}];

// ===== BOT STARTUP ===== //

function bot_init() {
	client.addListener('error', function(message) {
		log('error: ', message);
	});

	function handle_command(from,to,message) {
		var handled,input,out;
		
		trace("handle_command");
		
		// strip out the bot name for commands in a channel
		input = message.replace(config.regex_command,"");
		
		// trim leading space & punctuation
		input = input.replace(/^[\s,:]+/,"").replace(/\s+$/,"");
		
		_.each(command_list,function(c) {
			var m_command;
			
			if (handled) return;
			
			m_command = input.match(c.pattern);
			
			if (!m_command) return;
			
			handled = true;
			
			if (isfn(c.reply)) out = c.reply(from,to,input);
			else out = rand_el(c.reply);
			
			send(to,from,out,m_command,c.trigger||null,c.verbosity);
		});
		
		return handled;
	}

	function handle_repeat(from,to,message) {
		var repeat = rand_el(meta_lists.repeat);
		
		if (repeat == state.last_repeat) return;
		
		state.last_repeat = repeat;
		
		send(to,from,repeat,"",null);
	}

	function handle_message(from, to, message) {
		var chosen,handled,matched_list,out;
		
		state.last_evtime = moment();
		
		message = string(message).trim();
		
		if (message === "") return;
		
		trace("handle_message");
		log(from + ' => ' + to + ': [' + message + ']');
		
		if (to == config.name) to = from;
		
		if (message == state.last_message) return handle_repeat(from,to,message);
		
		if (message.match(config.regex_command)) {
			state.last_message = message;
			
			handled = handle_command(from,to,message);
		}
		
		if (handled) return;
		
		state.last_message = message;
		
		matched_list = [];
		
		_.each(pattern_list,function(p) {
			var m_message;
			
			m_message = message.match(p.pattern);
			
			if (!handled && m_message && state.last_pattern != p.pattern) {
				matched_list.push([p,m_message]);
			}
		});
		
		if (!matched_list.length) return;
		
		chosen = rand_el(matched_list);
		
		state.last_pattern = chosen[0].pattern;
		
		out = rand_el(chosen[0].reply);
		
		send(to,from,out,chosen[1],chosen[0]);
		
		handled = true;
	}
	client.addListener("message",handle_message);

	function handle_action(from,to,text,message) {
		var action_modifier,chance;
		
		state.last_evtime = moment();
		
		trace("handle_action");
		log(from + ' => ' + to + ' action: ' + text);
		
		chance = rand(0,3);
		
		if (chance == 1) return;
		else if (chance == 2) return handle_message(from,to,text);
		
		if (text == state.last_action) return;
		
		state.last_action = text;
		
		action_modifier = rand_el(action_modifiers);
		
		send(to,from,"/me " + text + " " + action_modifier,"","builtin: action handler");
	}
	client.addListener("action",handle_action);

	function nick_strip(nick) {
		return string(nick).replace(/[^\w]/,"");
	}

	function nick_add(nick) {
		var nick_pattern;
		
		nick = nick_strip(nick);
		
		if (!nick) return;
		
		if (nick === config.name) return;
		
		lists.nick.push(nick);
		
		lists.nick = _.uniq(lists.nick);
		nick_pattern = lists.nick.join("|");
		
		if (nick_pattern_index === -1) {
			nick_pattern_index = -1 + pattern_list.push({
				trigger : "builtin: <nick> reply <abuse>",
				builtin : true,
				pattern : new RegExp(".\\b("+nick_pattern+")\\b","i"),
				reply   : meta_lists.nick
			});
		}
		else {
			pattern_list[nick_pattern_index].pattern = new RegExp(".\\b("+nick_pattern+")\\b","i");
		}
	}

	function nick_remove(nick) {
		var nick_pattern;
		
		lists.nick = _.without(lists.nick,nick_strip(nick));
		nick_pattern = lists.nick.join("|");
		
		if (nick_pattern_index !== -1) {
			pattern_list[nick_pattern_index].pattern = new RegExp("\\b("+nick_pattern+")\\b","i");
		}
	}

	function handle_names(channel,nicks) {
		if (config.channels.indexOf(channel) !== 0) return;
		
		_.each(nicks,function(powers,nick) {
			return nick_add(nick);
		});
	}
	client.addListener("names",handle_names);

	function handle_join(channel,nick,message) {
		if (config.channels.indexOf(channel) !== 0) return;
		
		if (nick == config.name) {
			client.send("mode",nick,"+B");
		}
		
		nick_add(nick);
	}
	client.addListener("join",handle_join);

	function handle_part(channel,nick,reason,message) {
		if (config.channels.indexOf(channel) !== 0) return;
		
		nick_remove(nick);
	}
	client.addListener("part",handle_part);

	function handle_quit(nick,reason,channels,message) {
		nick_remove(nick);
	}
	client.addListener("part",handle_quit);

	function handle_kick(channel,nick,by,reason,message) {
		if (config.channels.indexOf(channel) !== 0) return;
		
		nick_remove(nick);
	}
	client.addListener("kick",handle_kick);

	function handle_nick(nickold,nicknew,channels,message) {
		nick_remove(nickold);
		nick_add(nicknew);
	}
	client.addListener("nick",handle_nick);

	log(config.name + " up.");
}
