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

var text;

text = {
	digits : ["zero", "one", 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
	teens  : ["ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"],
	tens   : ["","ten","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"]
};

interface Scale {
	scale:number;
	title:string;
}

var scales:Scale[] = [{
	scale : 1000000000000,
	title : "trillion"
},{
	scale : 1000000000,
	title : "billion"
},{
	scale : 1000000,
	title : "million"
},{
	scale : 1000,
	title : "thousand"
},{
	scale : 1,
	title : ""
}];

function part(num:number, scale:number):number {
	return Math.floor(num / scale);
}

function part_text(num:number):string {
	var temp;
	
	if (num === 0) return "";
	
	if (num >= 10 && num < 20) {
		return text.teens[num - 10];
	}
	else if (num > 99) {
		temp = part_text(num % 100);
		
		return part_text(part(num,100)) + " hundred" + (temp ? " " + temp : "");
	}
	else if (num > 10) {
		temp = part_text(num % 10);
		
		return text.tens[part(num,10)] + (temp ? " " + temp : "");
	}
	else {
		return text.digits[num];
	}
}

function num_to_str(num:number):string {
	var out;
	
	out = [];
	
	log("NUM",num);
	
	if (num === 0) return "zero";
	
	scales.forEach(function(scale) {
		var spart,stext;
		
		spart = part(num,scale.scale);
		
		if (spart === 0) {
			num = num % scale.scale;
			return;
		}
		
		stext = part_text(spart);
		
		if (stext) {
			out.push(stext);
			out.push(scale.title);
		}
		
		num = num % scale.scale;
	});
	
	return out.filter(bool).join(" ");
}

export = num_to_str;
