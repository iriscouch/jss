// The jss API
//

var sys = require('sys')
  , path = require('path')
  , events = require('events')
  ;

var package_json = path.join(path.dirname(module.filename), 'package.json');
package_json = require('fs').readFileSync(package_json);
package_json = JSON.parse(package_json);
exports.version = package_json.version;

function Stream () {
  var self = this;
  events.EventEmitter.call(self);

  self.test = null;
  self.format = null;
  self.in = null;
  self.out = null;
  self.pre    = null;
  self.suf    = null;
  self.head   = null;
  self.tail   = null;
  self.silent = null;
  self.state = {};

  self.on('line', function on_line(line) {
    if(!self.test)
      throw new Error("No JS test defined");

    var obj;
    try      { obj = JSON.parse(line) }
    catch(e) { return; /* Nothing to do */ }

    self.emit('json', obj);
  })

  self.on('json', function on_json(obj) {
    var scope = {}

    if(! ('caller' in self.state) ) self.state.caller = {};
    if(! ('_jss'   in self.state) ) self.state._jss   = {};

    var state = self.state._jss;
    function inc(key) {
      var previous_value = state[key] || 0;
      return previous_value + 1;
    }

    var awk_stuff = { '$INPUT_LINE_NUMBER' : inc('$INPUT_LINE_NUMBER')
                    , '$NR'                : inc('$NR')
                    }

    var key
    for (key in obj)
      scope[key] = obj[key];

    for (key in awk_stuff) {
      scope[key] = awk_stuff[key];
      state[key] = awk_stuff[key];
    }

    scope['$'] = obj;
    scope['$s'] = self.state.caller;

    var result = false;
    try      { result = self.test.apply(obj, [scope]) }
    catch(e) { return; }

    if( !! (result) )
      self.emit('match', obj, result);
  })

  function insert(type) {
    var val = self[type];
    if(val) {
      if(typeof val === 'string')
        self.out.write(val);
      else if(typeof val === 'function')
        self.out.write(val());
      else
        throw new Error("Unknown insertion: " + type);
    }
  }

  var match_count = 0;
  self.on('match', function on_match(obj, result) {
    if(match_count === 0)
      insert('head');

    match_count += 1;

    try {
      var output = self.format.apply(obj, [obj, result, self.state]);
      if(output) {
        insert('pre');
        self.out.write(output);
        insert('suf');
        self.out.write("\n");
      }
    } catch (e) {
      if(self.silent)
        return; /* Nothing to do */
      throw e;
    }
  })
}
sys.inherits(Stream, events.EventEmitter);

Stream.prototype.pump = function() {
  var self = this
    , ready_lines = []
    , unterminated = ""
    ;

  if(self.prefix)
    self.emit('line', self.prefix);

  self.in.setEncoding('utf8');
  self.in.on('data', function on_data(chunk) {
    chunk.split(/\r?\n/).forEach(function(line, a, lines) {
      if(a === 0) {
        line = unterminated + line;
        unterminated = "";
      }

      if(a + 1 === lines.length)
        unterminated = line;
      else
        ready_lines.push(line.replace(/,\s*$/, "")); // Strip possible comma and spaces
    })

    var a, line;
    for(a = 0; a < ready_lines.length; a++) {
      line = ready_lines[a];
      self.emit('line', line);
    }
  })

  self.in.on('end', function() {
    self.out.write(self.tail || '');
  })

  self.in.on('error', function(er) {
    console.log("!!!!!!!!!!!!!!" + er);
  })
}

exports.Stream = Stream;
