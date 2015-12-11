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

var irc = require("irc"),
	log = console.log;

var config = {
	channels : ["#hardcorepandas"],
	name     : "willy",
	server   : "irc.foonetic.net"
};

function rand(max) {
	return Math.floor(Math.random() * max);
}

function replace_tokens(str,from) {
	var out;
	
	out = str;
	
	out = out.replace(/\?from\b/g,from);
	out = out.replace(/\?rand_noun\b/g,noun_list[rand(noun_list.length)]);
	
	return out;
}

var client = new irc.Client(config.server,config.name,{
	// sasl : true,
	// port : 6697,
	// nick : config.name,
	// userName : 
	// password : 
	
	channels : config.channels
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

var patterns = [{
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

function handle_message(from, to, message) {
	log(from + ' => ' + to + ': ' + message);
	
	if (message == state.last_message) return;
	
	state.last_message = message;
	
	patterns.forEach(function(p,i) {
		var out;
		
		if (message.match(p.pattern) && state.last_pattern != p.pattern) {
			state.last_pattern = p.pattern;
			
			out = p.reply[rand(p.reply.length)];
			
			out = replace_tokens(out,from);
			
			if (out.match(/^\/me\s+/)) {
				client.action(to,out.replace(/^\/me\s+/,""));
			}
			else {
				client.say(to,out);
			}
		}
	});
}
client.addListener("message",handle_message);

function handle_action(from,to,text,message) {
	var action_modifier,chance;
	
	log(from + ' => ' + to + ' action: ' + text);
	
	chance = rand(3);
	
	if (chance == 1) return;
	else if (chance == 2) return handle_message(from,to,text);
	
	if (text == state.last_action) return;
	
	state.last_action = text;
	
	action_modifier = action_modifiers[rand(action_modifiers.length)];
	
	action_modifier = replace_tokens(action_modifier,from);
	
	client.action(to,text + " " + action_modifier);
}
client.addListener("action",handle_action);

log(config.name + " up.");
