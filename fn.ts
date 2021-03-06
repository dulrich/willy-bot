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

var util = require("util");

function array(a) {
	if (!isdef(a)) return [];
	
	return isarray(a) ? a : [a];
}

function bool(b:any):boolean {
	return (b === "false") ? false : Boolean(b);
}

function delay(fn:any, thisarg:any, args:any[], millis:number):void {
	setTimeout(function() {
		fn.apply(thisarg,args);
	},millis);
}

function eighth(n:any):string {
	var whole, fract;
	
	n = int((float(n) + 0.06125) * 8);
	
	whole = int(n / 8);
	fract = ["","1/8","1/4","3/8","1/2","5/8","3/4","7/8",""][n % 8];
	
	return "" + (whole ? (fract ? whole + " " + fract : whole) : fract || "0");
}

function escape(db,p,sub) {
	sub = bool(sub);
	
	if (isarray(p)) {
		return (sub && "(" || "") + p.map(function(v) {
			return escape(db,v,true);
		}).join(",") + (sub && ")" || "");
	}
	
	return db.escape(p);
}

function fixed(f:any, b?:number):string {
	return float(f).toFixed(ifdef(b,int(b),2));
}

function float(n:any):number {
	var f;
	f = parseFloat(n);
	return isFinite(f) ? f : 0;
}

function ifdef(v,a,b) {
	return isdef(v) ? a : b;
}

function int(n:any, b?:number):number {
	return parseInt(n,b||10) | 0; // jshint ignore:line
}

function isarray(a:any):boolean {
	return a instanceof Array;
}

function isdef(v:any):boolean {
	return v !== null && typeof v !== "undefined";
}

function isfn(f:any):boolean {
	return typeof f === "function";
}

function isndef(v:any):boolean {
	return v === null || typeof v === "undefined";
}

function isobj(o:any):boolean {
	return typeof o === "object";
}

function isstring(s:any):boolean {
	return typeof s === "string";
}

function log(...args:any[]):void {
	return console.log.apply(console,arguments);
}

function lowerCase(s:any):string {
	return string(s).toLowerCase();
}

function orin<T>(e:T, list:T[]):boolean {
	return array(list).indexOf(e) !== -1;
}

function rand(min:number, max:number):number {
	return min + Math.floor(Math.random() * (max - min));
}

function rand_el<T>(list:T|T[]):T {
	var ll:T[] = array(list);
	
	return ll[rand(0,ll.length)];
}

function safe_div(a:any, b:any):number {
	a = float(a);
	b = float(b);
	
	return b ? (a/b) : 0.0;
}

function string(s:any):string {
	return ifdef(s,""+s,"");
}

function trace(msg:string):void {
	log("TRACE: " + msg);
}

function U(format:string, ...args:any[]):string {
	return util.format.apply(util,arguments);
}

function upperCase(s:any):string {
	return string(s).toUpperCase();
}

interface DB {
	escape:any;
	query:any;
}

function query(db:DB, q:any, cb:(err:any, res:any[]) => void) {
	var exited,out,query_o,rx_match;
	
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

// why this default property of Function is unknown, is unknown
interface Function {
	name:string;
}

function globalize(o:Object):void {
	[
		array,bool,fixed,float,int,safe_div,
		ifdef,
		isarray,isdef,isfn,isndef,isobj,isstring,
		lowerCase,string,upperCase,
		delay,eighth,log,rand,rand_el,trace,U,
		escape,orin,query
	].forEach(function(fn:Function):void {
		o[fn.name] = fn;
	});
}

module.exports = globalize;
