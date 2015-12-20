// willy-bot: like wally and welly, the next-gen
// Copyright (C) 2014 - 2015  David Ulrich
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

var _ = require("lodash"),
	irc = require("irc"),
	log = console.log,
	moment = require("moment"),
	mysql = require("mysql"),
	util = require("util");

var config = require("./config.json");

config.regex_command = new RegExp("^"+config.name+"\\b","i");
config.bored_timeout = 5 * 60; // seconds
config.verbosity = config.verbosity || 1.0;
config.version = U("%s-bot-1.2.3",config.name);

function bool(b) {
	return (b === "false") ? false : Boolean(b);
}

function delay(fn,thisarg,args,millis) {
	setTimeout(function() {
		fn.apply(thisarg,args);
	},millis);
}

function escape(db,p,sub) {
	sub = bool(sub);
	
	if (isarray(p)) {
		return (sub && "(") + p.forEach(function(v) {
			return escape(db,v,true);
		}).join(",") + (sub && ")");
	}
	
	return db.escape(p);
}

function ifdef(v,a,b) {
	return isdef(v) ? a : b;
}

function int(n,b) {
	return parseInt(n,b||10) | 0;
}

function isarray(a) {
	return a instanceof Array;
}

function isdef(v) {
	return v !== null && typeof v !== "undefined";
}

function isfn(f) {
	return typeof f === "function";
}

function isobj(o) {
	return typeof o === "object";
}

function isstring(s) {
	return typeof s === "string";
}

function rand(min,max) {
	return min + Math.floor(Math.random() * (max - min));
}

function rand_el(list) {
	return list[rand(0,list.length)];
}

function string(s) {
	return ifdef(s,""+s,"");
}

function trace(msg) {
	log("TRACE: " + msg);
}

function U() {
	return util.format.apply(util,arguments);
}

function query(db,q,cb) {
	var exited,match,out,query_o,rx_match;
	
	exited = false;
	
	if (!db) {
		return cb("query: missing or falsey required arg 'db'",null);
	}
	
	query_o = isobj(q)
		? q
		: {
			ignore : false,
			query  : q,
			param  : {}
		};
	
	query_o.ignore = bool(query_o.ignore);
	query_o.query = string(query_o.query);
	query_o.param = query_o.param || {};
	
	if (!isobj(query_o.param)) {
		return cb("query: invalid q.param, must be an object",null);
	}
	
	rx_match = /\?\w+\b/gi;
	
	out = query_o.query.replace(rx_match,function(match,pos,str) {
		var param_s;
		
		if (exited) return "";
		
		param_s = match.substr(1);
		
		if (!query_o.param[param_s] && !query_o.ignore) {
			exited = true;
			
			cb("query: unatched template variable " + match[0],null);
			return "";
		}
		
		return escape(db,query_o.param[param_s],false);
	});
	
	// log("RUNNING QUERY:",query_o.query,out);
	
	db.query(out,cb);
}

function replace_tokens(str,from,m_match) {
	var match,out,rx_int;
	
	out = str;
	
	out = out.replace(/\?from\b/g,from);
	out = out.replace(/\?match\b/g,(m_match && m_match[0]) || "");
	
	out = out.replace(/\?rand_nick\b/g,rand_el(nick_list));
	
	rx_int = /\?rand_int([\d_]+)?/i;
	match = rx_int.exec(out) || [];
	
	var min,max;
	for(var i = 1; i < match.length;i++) {
		min = string(match[i]).split("_")[0];
		max = string(match[i]).split("_")[1];
		
		if (!max) {
			if (!min) min = 100;
			
			max = min;
			min = 0;
		}
		
		min = int(min);
		max = int(max);
		
		out = out.replace(/\?rand_int([\d_]+)?/,rand(min,max));
	}
	
	_.each(lists,function(list,name) {
		var rx_indef,rx_multi,rx_plain,rx_posses;
		var val;
		
		rx_indef = new RegExp("\\\?indef_"+name+"\\b","i");
		rx_multi = new RegExp("\\\?multi_"+name+"\\b","i");
		rx_plain = new RegExp("\\\?rand_"+name+"\\b","i");
		rx_posses = new RegExp("\\\?posses_"+name+"\\b","i");
		
		while(out.match(rx_indef)) {
			val = rand_el(list);
			val = val.match(/^[aeiou]/)
				? "an " + val
				: "a " + val;
			
			out = out.replace(rx_indef,val);
		}
		
		while(out.match(rx_multi)) {
			val = rand_el(list);
			
			val = val.replace(/y$/i,"ies");
			val = val.replace(/sh$/i,"shes");
			val = val.replace(/([^s])$/i,"$1s");
			
			out = out.replace(rx_multi,val);
		}
		
		while(out.match(rx_plain)) {
			out = out.replace(rx_plain,rand_el(list));
		}
		
		while(out.match(rx_posses)) {
			val = rand_el(list);
			
			val = val.replace(/s$/i,"s'");
			val = val.replace(/([^s])$/i,"$1's");
			
			out = out.replace(rx_posses,val);
		}
	});
	
	out = out.replace(/\?version\b/g,config.version);
	
	return out;
}

function send_raw(to,from,message,m_match,raw,trigger) {
	var out;
	
	out = message;
	
	if (!raw) {
		out = replace_tokens(out,from,m_match);
	}
	
	if (Math.random() > config.verbosity) {
		log("VERBOSITY LIMITED");
		return;
	}
	
	if (out.match(/^\/me\s+/)) {
		client.action(to,out.replace(/^\/me\s+/,""));
	}
	else {
		client.say(to,out);
	}
	
	log("ISAID: " + out);
	
	state.last_acttime = moment();
	
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

function send(to,from,message,m_match,trigger) {
	var raw;
	
	raw = false;
	if (message.match(/^\/raw\s+/i)) {
		message = message.replace(/^\/raw\s+/i,"");
		raw = true;
	}
	
	send_raw(to,from,message,m_match,raw,trigger);
}

var client = new irc.Client(config.server,config.name,{
	// sasl : true,
	// port : 6697,
	// userName : 
	// password : 
	
	channels : config.channels,
	floodProtection : true,
	floodProtectionDelay : 500,
	
	realName : config.realName || "unknown",
	userName : config.userName || "unknown"
});

var message_log = [];

var state = {
	last_action  : "",
	last_message : "",
	last_pattern : null,
	last_repeat  : "",
	last_evtime  : moment(),
	last_acttime : moment()
};

function act_bored() {
	var bored_list = [
		"/me ?rand_action",
		"?rand_nick: are you alive?",
		"ping"
	];
	
	if (state.last_evtime < state.last_acttime) return; // don't spam empty channel
	
	send(config.channels[0],"",rand_el(bored_list),"","builtin: y'all are boring");
}

var bored = setInterval(act_bored,config.bored_timeout * 1000);

var action_modifiers = [
	"too",
	"with ?from",
	"with ?indef_noun",
	"better than ?from"
];

var help = {
	help : {
		use    : "find commands, or get help with <cmd>. you need it.",
		syntax : "help | help <cmd>",
		notes  : ""
	},
	listadd : {
		use    : "add <item>+ to response list <list>",
		syntax : "listadd <list> <item>+",
		notes  : "* optionally multiple space-separated items"
	},
	listcreate : {
		use    : "create new response list <list>",
		syntax : "listcreate <list>",
		notes  : "* list is normally singular, 'animal' not 'animals'"
	},
	listshow  : {
		use    : "display existing lists with item counts, or display the items in <list>",
		syntax : "listshow | listshow <list>",
		notes  : ""
	},
	match : {
		use    : "create a new <reply> to <pattern>",
		syntax : "match <mode> /<pattern>/ reply <reply>",
		notes  : [
			"* mode is word or phrase, word matches whole words only",
			"* pattern is a regular express, use \\ for character classes, etc",
			"* reply is the rest of the message; use ?rand_<list> for more fun"
		]
	},
	rand : {
		use    : "get a random item from <list>",
		syntax : "rand <list>",
		notes  : ""
	},
	search : {
		use    : "look for patterns like <term>",
		syntax : "search <term>+",
		notes  : ""
	},
	version : {
		use    : "get version info for ?version",
		syntax : "version",
		notes  : ""
	}
};

var secret_list = [
	"Access Denied",
	"401 Unauthorized",
	"403 Forbidden",
	"sorry, that is not permitted",
	"?from is not in the sudoers file. This incident will be reported."
];

var command_list = [{
	trigger : U("command: %s.",help.help.syntax),
	pattern : /^help(\s+\w+)?$/i,
	reply   : function(from,to,input) {
		var match,name,reply,rx_match;
		
		rx_match = /^help\s+(\w+)?$/i;
		match = rx_match.exec(input);
		
		name = string(match && match[1]);
		
		reply = [];
		
		if (name) {
			if (!help[name]) {
				reply.push("?from,do you know how to type? " + name + " isn't a command");
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
			send(to,from,line,input,U("command: %s",help.help.syntax));
		}).value();
		
		return "if that doesn't help you, then nothing can";
	}
},{
	trigger : U("command: %s.","leave"),
	pattern : /(get out|leave)/i,
	reply  : function(from,to,input) {
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
	pattern : /(go die|kill you)/i,
	reply  : function(from,to,input) {
		delay(process.exit,null,[],100);
		
		return "/me commits suicide with ?indef_noun";
	}
},
{
	pattern : /^(time|got the time\??|what time is it\??)/i,
	reply   : function(from,to,input) {
		var times = [
			"?from: it's " + moment().format("llll") + " here",
			"?from: tomorrow is " + moment().to(moment().endOf("day")),
			"?from: it's " + moment().valueOf() + "ms into the Unix Epoch"
		];
		
		return rand_el(times);
	}
},
{
	trigger : U("command: %s.",help.listshow.syntax),
	pattern : /^listshow$/i,
	reply   : function(from,to,input) {
		var out;
		
		out = _.map(lists,function(list,name) {
			return U("%s: %d",name,list.length);
		}).join(", ");
		
		return out;
	}
},
{
	trigger : U("command: %s.",help.listshow.syntax),
	pattern : /^listshow \w+$/i,
	reply   : function(from,to,input) {
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
	trigger : U("command: %s.",help.listcreate.syntax),
	pattern : /^listcreate \w+$/i,
	reply   : function(from,to,input) {
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
	trigger : U("command: %s.",help.match.syntax),
	pattern : /^match (word|phrase) \/.+\/ reply .+$/i,
	reply   : function(from,to,input) {
		var match,mode,param_pattern,pattern,query_pattern,reply,rx_match;
		
		rx_match = /^match (word|phrase) \/(.+)\/ reply (.+)$/i;
		
		match = rx_match.exec(input);
		
		if (!match || !match[1] || !match[2] || !match[3]) {
			return "sorry ?from, your pattern is invalid";
		}
		
		mode    = match[1];
		pattern = match[2];
		reply   = match[3];
		
		if (
			pattern_map[pattern]
			&& _.contains(pattern_list[pattern_map[pattern]].reply)
		) {
			return U("?from: i already match that %s",mode);
		}
		
		param_pattern = {
			from    : from,
			mode    : mode,
			pattern : pattern,
			reply   : reply
		};
		
		query_pattern = "INSERT IGNORE INTO wb_pattern \
			SET PatternMode = ?mode, \
				PatternRegExp = ?pattern, \
				PatternReply = ?reply, \
				PatternNick = ?from";
		
		query(db,{
			query : query_pattern,
			param : param_pattern
		},function(err,res) {
			if (err) return log("FAILED TO START LIST :" + list,err);
			
			log("ADDED PATTERN: " + pattern);
			create_pattern(pattern,mode,reply,from)
		});
		
		return "?from: ?rand_assent";
	}
},
{
	trigger : U("command: %s.",help.match.syntax),
	pattern : /^match/i,
	reply   : ["?from, did you mean: " + help.match.syntax]
},
{
	trigger : U("command: %s.",help.listadd.syntax),
	pattern : /^listadd \w+\s+(\w+|"[^"]+")+/i,
	reply   : function(from,to,input) {
		var items,list,param_item,query_item;
		
		list = input.split(" ")[1];
		
		if (!lists[list]) {
			return "sorry ?from, that's not a valid list";
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
		
		item = input.match(/(\w+|"[\w-_ ]+")$/i)[0].replace(/"/g,"");
		
		
		
		
		
		return "ok ?from, ?rand_assent";
	}
},
{
	trigger : U("command: %s.",help.search.syntax),
	pattern : /^search\s+.+/i,
	reply   : function(from,to,input) {
		var param,query_search,term,terms;
		
		term = input.replace(/^search\s+/i,"");
		terms = term.split(/ _-/);
		
		query_search = "SELECT * FROM wb_pattern WHERE 0 ";
		
		param = {};
		_.each(terms,function(t,i) {
			query_search += " OR PatternRegExp LIKE ?term_"+i;
			query_search += " OR PatternReply LIKE ?term_"+i;
			param["term_" + i] = "%"+t+"%";
		});
		
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
				U("command: %s",help.search.syntax)
			);
			
			_.each(res,function(row) {
				send_raw(
					to,
					from,
					U("%s: /%s/ reply %s",row.PatternNick,row.PatternRegExp,row.PatternReply),
					input,
					true,
					U("command: %s",help.search.syntax)
				);
			});
		});
		
		return U("looking into %s for you",term);
	}
},
{
	trigger : U("command: %s.",help.version.syntax),
	pattern : /(who are you|version)/i,
	reply   : [
		"?version at your service",
		"?version reporting for duty",
		"?version build ?rand_int100000_600000"
	]
},
{
	trigger : U("command: %s.",help.rand.syntax),
	pattern : /^rand \w+$/i,
	reply   : function(to,from,input) {
		var items,list,param_item,query_item;
		
		list = input.split(" ")[1];
		
		if (!lists[list]) {
			return "tofu";
		}
		
		return U("?rand_%s",list);
	}
},
{
	trigger : "meta-loop",
	pattern : /^what was that\?/i,
	reply   : function(to,from,input) {
		var last;
		
		last = message_log[message_log.length - 1];
		
		if (!last || !last.trigger) {
			return rand_el(secret_list);
		}
		
		if (last.trigger == "meta-loop") {
			return "the inception has begun";
		}
		
		if (isstring(last.trigger) || last.trigger.builtin) {
			return U("that was %s",last.trigger.trigger);
		}
		
		return U("/raw that was %s: /%s/ reply %s",
			last.trigger.nick,
			last.trigger.trigger,
			last.trigger.reply);
	}
},
{
	pattern : /\bsudo\b/i,
	reply   : secret_list
},
{
	pattern : /(tell|make)\s/i,
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
	pattern : /.?/,
	reply   : [
		"would you like to learn about ?multi_animal?",
		"would you like to learn about ?multi_food?",
		"do you even speak ?rand_lang?",
		"how about i teach you ?rand_lang",
		"how about you go ?rand_action instead",
		"/me hums a tune",
		"/me humps ?from's ?rand_person",
		"i am not the bot you are looking for",
		"/me ?multi_action",
		"who, me?",
		"do you even have a ?rand_bodypart?",
		"i've got nothing left to do but ?rand_action"
	]
}];

var db = mysql.createConnection({
	host        : config.db_host,
	database    : config.db_name,
	user        : config.db_user,
	password    : config.db_pass,
	dateStrings : true
});

var lists = {};

var query_lists = "SELECT \
		L.ListName, \
		I.ItemText \
	FROM wb_item I \
	LEFT JOIN wb_list L ON I.ListID = L.ListID \
	WHERE NOT I._deleted \
		AND NOT L._deleted";

query(db,query_lists,function(err,res) {
	var list_pattern;
	
	if (err) return log("ERROR: failed to load replacement lists",err);
	
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
			"?multi_?match!!!",
			"uhh, maybe ?rand_?match?",
			"uhh, maybe ?multi_?match?"
		]
	});
});

var query_patterns = "SELECT \
		P.* \
	FROM wb_pattern P \
	WHERE NOT P._deleted \
	ORDER BY P.PatternPriority DESC,P.PatternRegExp,P.PatternReply";
var pattern_list,pattern_map;

pattern_list = [];
pattern_map = {};

function create_pattern(pattern,mode,reply,nick) {
	var index;
	
	pattern_map[pattern] = pattern_map[pattern] || pattern_list.length;
	
	index = pattern_map[pattern];
	
	pattern_list[index] = pattern_list[index] || {
		trigger : pattern,
		pattern : mode ==  "word"
			? new RegExp("\\b"+pattern+"\\b","i")
			: new RegExp(pattern,"i"),
		reply   : [],
		nick    : nick
	};
	
	pattern_list[index].reply.push(reply);
}

query(db,query_patterns,function(err,res) {
	if (err) return log("ERROR: failed to load patterns",err);
	
	_.each(res,function(row) {
		create_pattern(row.PatternRegExp,row.PatternMode,row.PatternReply,row.PatternNick);
	});
});

var repeat_list = [
	"?from, do you know how to read?",
	"?rand_lang. learn to read it",
	"you should learn ?rand_lang. try asking your ?rand_person",
	"my ?rand_person is more creative than you",
	"same old, same old...",
	"that sounds familiar",
	"stfu somebody already said that",
	"your ?rand_lang ?rand_person showed me that with ?indef_noun years ago"
];

client.addListener('error', function(message) {
	log('error: ', message);
});

function handle_command(from,to,message) {
	var handled,input,out;
	
	trace("handle_command");
	
	// strip out the bot name for commands in a channel
	input = message.replace(config.regex_command,"");
	
	// trim leading 
	input = input.replace(/^[\s,:]+/,"").replace(/\s+$/,"");
	
	_.each(command_list,function(c) {
		var m_command;
		
		if (handled) return;
		
		m_command = input.match(c.pattern);
		
		if (!m_command) return;
		
		handled = true;
		
		if (isfn(c.reply)) out = c.reply(from,to,input);
		else out = rand_el(c.reply);
		
		send(to,from,out,m_command,c.trigger||null);
	});
	
	return handled;
}

function handle_repeat(from,to,message) {
	var repeat = rand_el(repeat_list);
	
	if (repeat == state.last_repeat) return;
	
	state.last_repeat = repeat;
	
	send(to,from,repeat,"",null);
}

function handle_message(from, to, message) {
	var handled;
	
	state.last_evtime = moment();
	
	trace("handle_message");
	log(from + ' => ' + to + ': ' + message);
	
	if (to == config.name) to = from;
	
	if (message == state.last_message) return handle_repeat(from,to,message);
	
	if (message.match(config.regex_command)) {
		state.last_message = message;
		
		handled = handle_command(from,to,message);
	}
	
	if (handled) return;
	
	state.last_message = message;
	
	_.each(pattern_list,function(p) {
		var m_message,out;
		
		m_message = message.match(p.pattern);
		
		if (!handled && m_message && state.last_pattern != p.pattern) {
			state.last_pattern = p.pattern;
			
			out = rand_el(p.reply);
			
			send(to,from,out,m_message,p);
			
			handled = true;
		}
	});
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
	
	send(to,from,text + " " + action_modifier,"","builtin: action handler");
}
client.addListener("action",handle_action);

var nick_list = [];
var nick_pattern_index = -1;

function nick_strip(nick) {
	return string(nick).replace(/[^\w]/,"");
}

function nick_add(nick) {
	var nick_pattern;
	
	nick = nick_strip(nick);
	
	if (!nick) return;
	
	nick_list.push(nick);
	
	nick_list = _.uniq(nick_list);
	nick_pattern = nick_list.join("|");
	
	if (nick_pattern_index === -1) {
		nick_pattern_index = -1 + pattern_list.push({
			trigger : "builtin: <nick> reply <abuse>",
			builtin : true,
			pattern : new RegExp("\\b("+nick_pattern+")\\b","i"),
			reply   : [
				"?match, is a punk",
				"this one time i hooked up with ?match's ?rand_person",
				"?match!!!"
			]
		});
	}
	else {
		pattern_list[nick_pattern_index].pattern = new RegExp("\\b("+nick_pattern+")\\b","i");
	}
}

function nick_remove(nick) {
	nick_list = _.without(nick_list,nick_strip(nick));
	
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
	
	// if (nick == config.name) client.send("names",config.channels[0]);
	
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
