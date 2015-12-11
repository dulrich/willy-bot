# willy-bot

like wally and welly, the next-gen


# functionality

* set pools of one or more potential responses based on channel or private messages
* substitution patters (from,rand_noun,rand_verb,etc) in responses
* have bot perform channel commands on request (mute,kick,etc) if it is an op


# installing

* `sudo apt-get install libicu-dev` for `node-irc` dependency
* `npm install`
* copy `config.example.json` to `config.json` and insert your desired info
* `node willy.js` or your choice of node daemonizers


# settings

The foloowing settings are recognized by willy-bot in `config.json`

* **name** (string,required): the bot's nick
* **channels** (string array,required): list of channels for the bot to join
* **server** (string,required): server the bot should connect to


# license

willy-bot is copyright (C) 2015  David Ulrich.

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
