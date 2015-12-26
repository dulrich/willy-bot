CREATE DATABASE IF NOT EXISTS willy_bot;

USE willy_bot;

CREATE TABLE IF NOT EXISTS wb_pattern (
	PatternID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	PatternMode ENUM ('phrase','word') NOT NULL DEFAULT 'phrase',
	PatternRegExp VARCHAR(100) NOT NULL DEFAULT '*',
	PatternReply VARCHAR(500) NOT NULL DEFAULT 'nothing',
	PatternPriority TINYINT NOT NULL DEFAULT 1,
	PatternNick VARCHAR(100) NOT NULL DEFAULT '',
	PatternDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	_deleted TINYINT NOT NULL DEFAULT 0,
	UNIQUE(PatternRegExp,PatternReply)
) engine=InnoDB;

INSERT IGNORE INTO wb_pattern(PatternMode,PatternRegExp,PatternReply,PatternNick) VALUES
	('Word','goats?','goats. Goats! GOATS!!!','avid'),
	('Word','goats?','1 goat, 2 goat, red goat, blue goat','avid'),
	('Word','(hitler|nazis?)','you say ?match? by Godwin''s law I say... YOU LOSE!','avid'),
	('Word','numbers?','my favorite number is ?rand_int1_101','avid'),
	('Word','random','you know what''s random? ?rand_int337_1117','avid'),
	('Word','pandas?','Yay pandas!','avid'),
	('Word','pandas?','I <3 pandas :D','avid'),
	('Word','problems?','?rand_group cause all of the world''s problems','avid'),
	('Word','problems?','i''ve got ?rand_int problems but ?indef_person ain''t one','avid'),
	('Word','problems?','i''ve got ?rand_int problems but ?rand_group aren''t one anymore','avid'),
	('Phrase','monty\\s+python','your ?rand_person was ?indef_animal, and your ?rand_person smelt of ?multi_food','avid'),
	('Phrase','things?(\\s+\\w+)+\\s+own','the things you own, end up owning you','avid'),
	('Word','stfu','how about you stfu first','avid'),
	('Word','stfu','your ?rand_person stfu last night','avid'),
	('Word','wikipedia','All hail the Infallible Wikipedia!!!','avid'),
	('Word','fishing','will you take me fishing, ?from?','avid'),
	('Word','fishing','/me goes fishing','avid'),
	('Word','shopping','buy whatever you want, it will never fill the existential void in your soul','avid');

CREATE TABLE IF NOT EXISTS wb_list (
	ListID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	ListName VARCHAR(8) NOT NULL DEFAULT '',
	_deleted TINYINT NOT NULL DEFAULT 0,
	UNIQUE (ListName)
) engine=InnoDB;

CREATE TABLE IF NOT EXISTS wb_item (
	ItemID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	ListID INT NOT NULL DEFAULT 0,
	ItemText VARCHAR(100) NOT NULL DEFAULT '',
	_deleted TINYINT NOT NULL DEFAULT 0,
	UNIQUE (ListID,ItemText)
) engine=InnoDB;

INSERT IGNORE INTO wb_list (ListID,ListName) VALUES
	(1,'lang'),
	(2,'noun'),
	(3,'person'),
	(4,'group'),
	(5,'animal'),
	(6,'plant'),
	(7,'food');

INSERT IGNORE INTO wb_item (ListID,ItemText) VALUES
	(1,'arabic'),
	(1,'chinese'),
	(1,'danish'),
	(1,'dutch'),
	(1,'english'),
	(1,'estonian'),
	(1,'french'),
	(1,'gaelic'),
	(1,'german'),
	(1,'hungarian'),
	(1,'irish'),
	(1,'italian'),
	(1,'japanese'),
	(1,'latin'),
	(1,'magyar'),
	(1,'mandarin'),
	(1,'norwegian'),
	(1,'olde english'),
	(1,'polish'),
	(1,'russian'),
	(1,'swedish'),
	(1,'thai'),
	(1,'turkish'),
	(1,'vietnamese'),
	(1,'welsh'),
	(1,'yiddish');

INSERT IGNORE INTO wb_item (ListID,ItemText) VALUES
	(2,'AK-47'),
	(2,'boom stick'),
	(2,'frying pan'),
	(2,'glock 21'),
	(2,'murse'),
	(2,'large trout'),
	(2,'pair of scissors'),
	(2,'sockeye salmon'),
	(2,'trout'),
	(2,'uzi'),
	(2,'water bottle');

INSERT IGNORE INTO wb_item (ListID,ItemText) VALUES
	(3,'aunt'),
	(3,'brother'),
	(3,'brother-in-law'),
	(3,'boyfriend'),
	(3,'cousin'),
	(3,'dad'),
	(3,'ex'),
	(3,'father'),
	(3,'father-in-law'),
	(3,'girlfriend'),
	(3,'grandfather'),
	(3,'grandmother'),
	(3,'great-aunt'),
	(3,'great-uncle'),
	(3,'lawyer'),
	(3,'mom'),
	(3,'mother'),
	(3,'mother-in-law'),
	(3,'nephew'),
	(3,'niece'),
	(3,'piano teacher'),
	(3,'platonic life partner'),
	(3,'significant other'),
	(3,'spouse'),
	(3,'uncle');

INSERT IGNORE INTO wb_item (ListID,ItemText) VALUES
	(4,'africans'),
	(4,'americans'),
	(4,'arabs'),
	(4,'asians'),
	(4,'assholes'),
	(4,'atheists'),
	(4,'body thetans'),
	(4,'buddhists'),
	(4,'businessmen'),
	(4,'catholics'),
	(4,'christians'),
	(4,'conservatives'),
	(4,'cops'),
	(4,'europeans'),
	(4,'french'),
	(4,'germans'),
	(4,'hindus'),
	(4,'intellectuals'),
	(4,'liberals'),
	(4,'jews'),
	(4,'marxists'),
	(4,'men'),
	(4,'mexicans'),
	(4,'mormons'),
	(4,'muslims'),
	(4,'new yorkers'),
	(4,'pagans'),
	(4,'politicians'),
	(4,'protestants'),
	(4,'racists'),
	(4,'russians'),
	(4,'women'),
	(4,'xenophobes');

-- animal
INSERT IGNORE INTO wb_item (ListID,ItemText) VALUES
	(5,'bat'),
	(5,'bird'),
	(5,'cat'),
	(5,'chicken'),
	(5,'cow'),
	(5,'deer'),
	(5,'dog'),
	(5,'dolphin'),
	(5,'duck'),
	(5,'fly'),
	(5,'gander'),
	(5,'gerbil'),
	(5,'goldfish'),
	(5,'hamster'),
	(5,'hog'),
	(5,'goose'),
	(5,'horse'),
	(5,'lizard'),
	(5,'monkey'),
	(5,'narwhal'),
	(5,'pig'),
	(5,'salmon'),
	(5,'snake'),
	(5,'spider'),
	(5,'tuna'),
	(5,'turtle'),
	(5,'whale');

-- plant
INSERT IGNORE INTO wb_item (ListID,ItemText) VALUES
	(6,'bush'),
	(6,'flower'),
	(6,'grass'),
	(6,'shrubbery'),
	(6,'tree');

-- food
INSERT IGNORE INTO wb_item (ListID,ItemText) VALUES
	(7,'artichoke'),
	(7,'banana'),
	(7,'bacon'),
	(7,'cake'),
	(7,'carrot'),
	(7,'elderberry'),
	(7,'orange'),
	(7,'mushroom'),
	(7,'potato'),
	(7,'rutebaga'),
	(7,'salmon'),
	(7,'steak'),
	(7,'truffle'),
	(7,'tuna');

CREATE TABLE IF NOT EXISTS wb_meta_list (
	MetaListID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	MetaListName VARCHAR(8) NOT NULL DEFAULT '',
	_deleted TINYINT NOT NULL DEFAULT 0,
	UNIQUE (MetaListName)
) engine=InnoDB;

CREATE TABLE IF NOT EXISTS wb_meta_item (
	MetaItemID INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	MetaListID INT NOT NULL DEFAULT 0,
	MetaReply VARCHAR(500) NOT NULL DEFAULT 'nothing',
	MetaNick VARCHAR(100) NOT NULL DEFAULT '',
	MetaDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	_deleted TINYINT NOT NULL DEFAULT 0,
	UNIQUE(MetaListID,MetaReply)
) engine=InnoDB;

INSERT IGNORE INTO wb_meta_list (MetaListID,MetaListName) VALUES
	(1,'repeat'),
	(2,'bored'),
	(3,'secret'),
	(4,'nothing');

INSERT IGNORE INTO wb_meta_item (MetaListID,MetaReply,MetaNick) VALUES
	(1,'?from, do you know how to read?','avid'),
	(1,'?rand_lang. learn to read it','avid'),
	(1,'you should learn ?rand_lang. try asking your ?rand_person','avid'),
	(1,'my ?rand_person is more creative than you','avid'),
	(1,'same old, same old...','avid'),
	(1,'that sounds familiar','avid'),
	(1,'stfu somebody already said that','avid'),
	(1,'your ?rand_lang ?rand_person showed me that with ?indef_noun years ago','avid'),
	(1,'that sounds familiar, kind of like your ?rand_person is with my ?rand_bodypart','avid');

INSERT IGNORE INTO wb_meta_item (MetaListID,MetaReply,MetaNick) VALUES
	(2,'/me ?multi_action','avid'),
	(2,'?rand_nick: are you alive?','avid'),
	(2,'ping','avid'),
	(2,'/me pokes ?rand_nick');

INSERT IGNORE INTO wb_meta_item (MetaListID,MetaReply,MetaNick) VALUES
	(3,'Access Denied','avid'),
	(3,'401 Unauthorized','avid'),
	(3,'403 Forbidden','avid'),
	(3,'404 Not Found','avid'),
	(3,'sorry, that is not permitted','avid'),
	(3,'?from is not in the sudoers file. This incident will be reported.','avid'),
	(3,'throws ?indef_noun at ?from','avid');

INSERT IGNORE INTO wb_meta_item (MetaListID,MetaReply,MetaNick) VALUES
	(4,'would you like to learn about ?multi_animal?','avid'),
	(4,'would you like to learn about ?multi_food?','avid'),
	(4,'do you even speak ?rand_lang?','avid'),
	(4,'how about i teach you ?rand_lang','avid'),
	(4,'how about you go ?rand_action instead','avid'),
	(4,'/me hums a tune','avid'),
	(4,'/me humps ?from''s ?rand_person','avid'),
	(4,'i am not the bot you are looking for','avid'),
	(4,'/me ?multi_action','avid'),
	(4,'who, me?','avid'),
	(4,'do you even have a ?rand_bodypart?','avid'),
	(4,'i''ve got nothing left to do but ?rand_action','avid');
