var text;

text = {
	digits : ["zero", "one", 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
	teens  : ["ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"],
	tens   : ["","ten","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"]
};

var scales = [{
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

function part(num,scale) {
	return Math.floor(num / scale);
}

function part_text(num) {
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

function num_to_str(num) {
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

module.exports = num_to_str;
