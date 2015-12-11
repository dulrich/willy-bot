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

function trace(msg) {
	log("TRACE: " + msg);
}

function replace_tokens(str,from) {
	var out;
	
	out = str;
	
	out = out.replace(/\?from\b/g,from);
	out = out.replace(/\?rand_noun\b/g,noun_list[rand(noun_list.length)]);
	
	return out;
}

function send(to,from,message) {
	message = replace_tokens(message,from);
	
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
	// nick : config.name,
	// userName : 
	// password : 
	
	channels : config.channels,
	
	realName : config.realName || "unknown",
	userName : config.userName || "unknown"
});

var state = {
	last_action  : "",
	last_message : "",
	last_pattern : null
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
		delay(client.part,client,[to],100);
		
		return "ok ?from, i'm out";
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
		
		return times[rand(times.length)];
	}
},
{
	pattern : /.?/,
	reply   : ["i am not the bot you are looking for","who, me?"]
}];

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

var repeat_list = [
	"?from do you know how to read?",
	"that sounds familiar",
	"stfu somebody already said that"
];

var pattern_list = [{
	pattern : /panda/i,
	reply   : ["Yay pandas!","I <3 pandas :D"]
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
		if (!handled && input.match(c.pattern)) {
			handled = true;
			
			if (isfn(c.reply)) out = c.reply(from,to,message);
			else out = c.reply[rand(c.reply.length)];
		}
	});
	
	if (handled) send(to,from,out);
	
	return handled;
}

function handle_repeat(from,to,message) {
	send(to,from,repeat_list[rand(repeat_list.length)]);
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
		var out;
		
		if (!handled && message.match(p.pattern) && state.last_pattern != p.pattern) {
			state.last_pattern = p.pattern;
			
			out = p.reply[rand(p.reply.length)];
			
			send(to,from,out);
			
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
	
	action_modifier = action_modifiers[rand(action_modifiers.length)];
	
	send(to,from,text + " " + action_modifier);
}
client.addListener("action",handle_action);

log(config.name + " up.");
