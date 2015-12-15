CREATE DATABASE IF NOT EXISTS willy_bot;

USE willy_bot;

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
