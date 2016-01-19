# willy-bot

like wally and welly, but the next-gen


# functionality

* respond to matched words (regex) in channel/query messages
* substitution patterns (from,rand_noun,rand_verb,etc) in responses
* basic, multiple, cap-cased, indefinite article, possessive, and unique substitutions
* list management commands
* inline replaces `?or_one_two_three` for minor lists
* random numbers via `?rand_intX_Y`
* have bot perform channel commands on request (mute,kick,etc) if it is an op


# installing

* `sudo apt-get install libicu-dev` for `node-irc` dependency
* `npm install`
* copy `config.example.json` to `config.json` and insert your desired info
* `node willy.js` or your choice of node daemonizers (nodemon, forever, pm2, etc)


# settings

The following settings are recognized by willy-bot in `config.json`

* **name** (string,required): the bot's nick
* **channels** (string array,required): list of channels for the bot to join
* **server** (string,required): server the bot should connect to
* **realName** (string,required): the nick of the bot owner
* **userName** (string,required): the nick of the bot owner
* **bored_timeout** (integer): inactivity time before bot says something random
* **mode** (string): post-process test with rules (normal|ye olde englishe|l33t h4x0r)

The following settings control the bot's database backend:

* **db_host**
* **db_name**
* **db_user**
* **db_pass**


# license

willy-bot is copyright (C) 2015 - 2016  David Ulrich.

For full license details see LICENSE.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
