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
config.verbosity = config.verbosity || 1.0;
config.version = "willy-bot-1.1.3";

function delay(fn,thisarg,args,millis) {
	setTimeout(function() {
		fn.apply(thisarg,args);
	},millis);
}

function ifdef(v,a,b) {
	return isdef(v) ? a : b;
}

function int(n,b) {
	return parseInt(n,b||10) | 0;
}

function isdef(v) {
	return v !== null && typeof v !== "undefined";
}

function isfn(f) {
	return typeof f == "function";
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

function replace_tokens(str,from,m_match) {
	var match,out,rx_int;
	
	out = str;
	
	out = out.replace(/\?from\b/g,from);
	out = out.replace(/\?match\b/g,(m_match && m_match[0]) || "");
	
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
		var rx_indef,rx_multi,rx_plain;
		var val;
		
		rx_indef = new RegExp("\\\?indef_"+name+"\\b","i");
		rx_multi = new RegExp("\\\?multi_"+name+"\\b","i");
		rx_plain = new RegExp("\\\?rand_"+name+"\\b","i");
		
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
	});
	
	out = out.replace(/\?version\b/g,config.version);
	
	return out;
}

function send(to,from,message,m_match) {
	message = replace_tokens(message,from,m_match);
	
	if (Math.random() > config.verbosity) {
		log("VERBOSITY LIMITED");
		return;
	}
	
	if (message.match(/^\/me\s+/)) {
		client.action(to,message.replace(/^\/me\s+/,""));
	}
	else {
		client.say(to,message);
	}
	
	log("ISAID: " + message);
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

var state = {
	last_action  : "",
	last_message : "",
	last_pattern : null,
	last_repeat  : ""
};

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
		use    : "add <item> to response list <list>",
		syntax : "listadd <list> <item>",
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
	}
};

var command_list = [{
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
				reply.push(name + ": " + help[name].use);
				reply.push(name + " syntax:");
				reply.push(help[name].syntax);
				
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
			send(to,from,line,input);
		}).value();
		
		return "if that doesn't help you, then nothing can";
	}
},{
	pattern : /(get out|leave)/i,
	reply  : function(from,to,input) {
		var partings = [
			"ok ?from, i'm out",
			"/me flees",
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
	pattern : /(got the time\??|what time is it\??)/i,
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
	pattern : /^listshow$/i,
	reply   : function(from,to,input) {
		var out;
		
		out = _.map(lists,function(list,name) {
			return util.format("%s: %d",name,list.length);
		}).join(", ");
		
		return out;
	}
},
{
	pattern : /^listshow \w+$/i,
	reply   : function(from,to,input) {
		var list,out;
		
		list = input.split(" ")[1];
		
		if (!lists[list]) return "?from: that's not a valid list";
		
		out = _.map(lists[list],function(item) {
			return util.format("%s",item);
		}).join(", ");
		
		return out;
	}
},
{
	pattern : /^listcreate \w+$/i,
	reply   : function(from,to,input) {
		var list,query_list;
		
		list = input.split(" ")[1];
		
		if (lists[list]) {
			return "?from: that list already exists; do i look like your ?rand_person?";
		}
		
		query_list = "INSERT IGNORE INTO wb_list \
			SET ListName = " + db.escape(list);
		
		db.query(query_list,function(err,res) {
			if (err) return log("FAILED TO START LIST :" + list,err);
			
			log("STARTED LIST: " + list);
			lists[list] = [];
		});
		
		return "?from: i'm on it";
	}
},
{
	pattern : /^match (word|phrase) \/.+\/ reply .+$/i,
	reply   : function(from,to,input) {
		var match,mode,pattern,query_pattern,reply,rx_match;
		
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
			return "?from: i already match that " + mode;
		}
		
		query_pattern = "INSERT IGNORE INTO wb_pattern \
			SET PatternMode = " + db.escape(mode) +", \
				PatternRegExp = " + db.escape(pattern) + ", \
				PatternReply = " + db.escape(reply) + ", \
				PatternNick = " + db.escape(from);
		
		db.query(query_pattern,function(err,res) {
			if (err) return log("FAILED TO START LIST :" + list,err);
			
			log("ADDED PATTERN: " + pattern);
			create_pattern(pattern,mode,reply,from)
		});
		
		return "?from: got it";
	}
},
{
	pattern : /^match/i,
	reply   : ["?from, did you mean: " + help.match.syntax]
},
{
	pattern : /^listadd \w+\s+\w+/i,
	reply   : function(from,to,input) {
		var items,list,query_item;
		
		list = input.split(" ")[1];
		
		if (!lists[list]) {
			return "sorry ?from, that's not a valid list";
		}
		
		items = input.replace(/^listadd \w+\s+/i,"").match(/("[\w_-\s]+"|\w+)/g);
		
		if (!items || !items.length) return "uhhh... idk what happened";
		
		_.each(items,function(item) {
			item = item.replace(/"/g,"").replace(/^\s+/,"").replace(/\s+$/,"");
			
			if (_.contains(lists[list],item)) {
				return "?from: i already have that";
			}
			
			query_item = "INSERT IGNORE INTO wb_item \
				SET ItemText = " + db.escape(item) + ",\
					ListID = (\
					SELECT ListID FROM wb_list WHERE ListName = " + db.escape(list) + ")";
			
			db.query(query_item,function(err,res) {
				if (err) return log("FAILED TO ADD ITEM: " + list + ", " + item,err);
				
				log("ADDED LIST ITEM: " + list + ", " + item);
				lists[list].push(item);
			});
		});
		
		item = input.match(/(\w+|"[\w-_ ]+")$/i)[0].replace(/"/g,"");
		
		
		
		
		
		return "ok ?from, i'll put it in";
	}
},
{
	pattern : /(who are you|version)/i,
	reply   : [
		"?version at your service",
		"?version reporting for duty",
		"?version build ?rand_int100000_600000"
	]
},
{
	pattern : /\bsudo\b/i,
	reply   : ["?from is not in the sudoers file. This incident will be reported."]
},
{
	pattern : /(tell|make)\s/i,
	reply   : function(from,to,input) {
		var match,out,rx;
		
		out = input;
		rx = /^(tell|make)\s+(\w+)(.+)?/i;
		
		match = rx.exec(input);
		
		if (match && match[1] && match[2]) {
			out = util.format(
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
		"do you even speak ?rand_lang?",
		"/me hums a tune",
		"/me humps ?from's ?rand_person",
		"i am not the bot you are looking for",
		"/me whistles",
		"who, me?"
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

db.query(query_lists,function(err,res) {
	if (err) return log("ERROR: failed to load replacement lists",err);
	
	_.each(res,function(row) {
		lists[row.ListName] = lists[row.ListName] || [];
		
		lists[row.ListName].push(row.ItemText);
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
		pattern : mode ==  "word"
			? new RegExp("\\b"+pattern+"\\b","i")
			: new RegExp(pattern,"i"),
		reply   : [],
		nick    : nick
	};
	
	pattern_list[index].reply.push(reply);
}

db.query(query_patterns,function(err,res) {
	if (err) return log("ERROR: failed to load patterns",err);
	
	_.each(res,function(row) {
		create_pattern(row.PatternRegExp,row.PatternMode,row.PatternReply,row.PatternNick);
	});
	
	log(pattern_list);
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
		
		send(to,from,out,m_command);
	});
	
	return handled;
}

function handle_repeat(from,to,message) {
	var repeat = rand_el(repeat_list);
	
	if (repeat == state.last_repeat) return;
	
	state.last_repeat = repeat;
	
	send(to,from,repeat,"");
}

function handle_message(from, to, message) {
	var handled;
	
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
			
			send(to,from,out,m_message);
			
			handled = true;
		}
	});
}
client.addListener("message",handle_message);

function handle_action(from,to,text,message) {
	var action_modifier,chance;
	
	trace("handle_action");
	log(from + ' => ' + to + ' action: ' + text);
	
	chance = rand(0,3);
	
	if (chance == 1) return;
	else if (chance == 2) return handle_message(from,to,text);
	
	if (text == state.last_action) return;
	
	state.last_action = text;
	
	action_modifier = rand_el(action_modifiers);
	
	send(to,from,text + " " + action_modifier);
}
client.addListener("action",handle_action);

log(config.name + " up.");
