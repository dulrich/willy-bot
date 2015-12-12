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
	moment = require("moment");

var config = require("./config.json");

config.regex_command = new RegExp("^"+config.name+"\\b","i");
config.verbosity = config.verbosity || 1.0;
config.version = "willy-bot-1.0.3";

function delay(fn,thisarg,args,millis) {
	setTimeout(function() {
		fn.apply(thisarg,args);
	},millis);
}

function isfn(f) {
	return typeof f == "function";
}

function rand(max) {
	return Math.floor(Math.random() * max);
}

function rand_el(list) {
	return list[rand(list.length)];
}

function trace(msg) {
	log("TRACE: " + msg);
}

function replace_tokens(str,from,m_match) {
	var out;
	
	out = str;
	
	out = out.replace(/\?from\b/g,from);
	out = out.replace(/\?match\b/g,(m_match && m_match[0]) || "");
	
	out = out.replace(/\?rand_lang\b/g,rand_el(lang_list));
	out = out.replace(/\?rand_noun\b/g,rand_el(noun_list));
	out = out.replace(/\?rand_person\b/g,rand_el(person_list));
	
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
	"with a?rand_noun",
	"better than ?from"
];

var command_list = [{
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
		
		return "/me commits suicide with a?rand_noun";
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
	pattern : /(who are you|version)/i,
	reply   : ["?version at your service","?version reporting for duty"]
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

var lang_list = [
	"arabic",
	
	"chinese",
	"danish","dutch",
	"english","estonian",
	"french",
	"gaelic","german",
	"hungarian",
	"irish","italian",
	"japanese",
	
	"latin",
	"magyar","mandarin",
	"norwegian",
	"olde english",
	"polish",
	
	"russian",
	"swedish",
	"thai","turkish",
	
	"vietnamese",
	"welsh",
	
	"yiddish"
	
];

var noun_list = [
	"n AK-47",
	" boom stick",
	" frying pan",
	" glock 21",
	" murse",
	" large trout",
	" pair of scissors",
	" sockeye salmon",
	" trout",
	"n uzi",
	" water bottle"
];

var person_list = [
	"aunt",
	"brother",
	"brother-in-law",
	"boyfriend",
	"cousin",
	"dad",
	"ex",
	"father",
	"father-in-law",
	"girlfriend",
	"grandfather",
	"grandmother",
	"great-aunt",
	"great-uncle",
	"lawyer",
	"mom",
	"mother",
	"mother-in-law",
	"nephew",
	"niece",
	"piano teacher",
	"platonic life partner",
	"significant other",
	"spouse",
	"uncle"
];

var repeat_list = [
	"?from, do you know how to read?",
	"?rand_lang. learn to read it",
	"you should learn ?rand_lang. try asking your ?rand_person",
	"my ?rand_person is more creative than you",
	"same old, same old...",
	"that sounds familiar",
	"stfu somebody already said that",
	"your ?rand_lang ?rand_person showed me that with a?rand_noun years ago"
];

var pattern_list = [{
	pattern : /goat/i,
	reply   : ["goats. Goats! GOATS!!!","1 goat, 2 goat, red goat, blue goat"]
},{
	pattern : /(hitler|nazis?)/i,
	reply   : ["you say ?match? by Godwin's law I say... YOU LOSE!"]
},{
	pattern : /panda/i,
	reply   : ["Yay pandas!","I <3 pandas :D"]
},{
	pattern : /things?(\s+\w+)+\s+own/i,
	reply   : ["the things you own, end up owning you"]
},{
	pattern : /stfu/i,
	reply   : ["how about you stfu first","your ?rand_person stfu last night"]
},{
	pattern : /wikipedia/i,
	reply   : ["All hail the Infallible Wikipedia!!!"]
},{
	pattern : /fishing/i,
	reply   : ["will you take me fishing, ?from?","/me goes fishing"]
}];

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
	
	command_list.forEach(function(c) {
		var m_command;
		
		if (handled) return;
		
		m_command = input.match(c.pattern);
		
		if (!m_command) return;
		
		handled = true;
		
		if (isfn(c.reply)) out = c.reply(from,to,message);
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
	
	if (message == state.last_message) return handle_repeat(from,to,message);
	
	if (message.match(config.regex_command)) {
		state.last_message = message;
		
		handled = handle_command(from,to,message);
	}
	
	if (handled) return;
	
	state.last_message = message;
	
	pattern_list.forEach(function(p) {
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
client.addListener("pm",function(from,message) {
	handle_message(from,from,message);
});

function handle_action(from,to,text,message) {
	var action_modifier,chance;
	
	trace("handle_action");
	log(from + ' => ' + to + ' action: ' + text);
	
	chance = rand(3);
	
	if (chance == 1) return;
	else if (chance == 2) return handle_message(from,to,text);
	
	if (text == state.last_action) return;
	
	state.last_action = text;
	
	action_modifier = rand_el(action_modifiers);
	
	send(to,from,text + " " + action_modifier);
}
client.addListener("action",handle_action);

log(config.name + " up.");
