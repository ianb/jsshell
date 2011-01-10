(function() {
  var CommandSet, commandSet, getMatch, parseLs;
  var __indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++) {
      if (this[i] === item) return i;
    }
    return -1;
  };
  CommandSet = (function() {
    function CommandSet() {
      this.commands = {};
      this.filters = {};
    }
    CommandSet.prototype.has = function(command) {
      if (typeof command !== 'string') {
        command = command.command;
      }
      if (!(command != null)) {
        command = '';
      }
      return command in this.commands;
    };
    CommandSet.prototype.run = function(command, outputer, console) {
      var c, result;
      c = this.commands[command.command || ''];
      result = c(command, outputer, console);
      result || (result = 0);
      return console.dataReceived(null, {
        code: result
      });
    };
    CommandSet.prototype.add = function(name, func) {
      return this.commands[name] = func;
    };
    CommandSet.prototype.addFilter = function(name, matchFunc, obj) {
      if (!(name in this.filters)) {
        this.filters[name] = [];
      }
      return this.filters[name].push([matchFunc, obj]);
    };
    CommandSet.prototype.match = function(name, thing) {
      var matchFunc, matchName, obj, result, _i, _j, _len, _len2, _ref, _ref2, _ref3;
      result = [];
      _ref = [name, '*'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        matchName = _ref[_i];
        if (this.filters[matchName]) {
          _ref2 = this.filters[matchName];
          for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
            _ref3 = _ref2[_j], matchFunc = _ref3[0], obj = _ref3[1];
            if ((!(matchFunc != null)) || matchFunc(thing)) {
              result.push(obj);
            }
          }
        }
      }
      return result;
    };
    return CommandSet;
  })();
  window.commandSet = commandSet = new CommandSet();
  commandSet.add('cd', function(command, outputer, console) {
    if (!command.args.length || __indexOf.call(command.args, '-h') >= 0) {
      outputer({
        stdout: "Usage: cd DIR"
      });
      if (__indexOf.call(command.args, '-h') >= 0) {
        return 0;
      } else {
        return 1;
      }
    }
    console.cwd(command.args[0]);
    return outputer({
      code: 0
    });
  });
  commandSet.add('setenv', function(command, outputer, console) {
    var env, key, keys, value, _i, _len;
    if (!command.args.length) {
      env = command.env;
      keys = (function() {
        var _results;
        _results = [];
        for (key in env) {
          _results.push(key);
        }
        return _results;
      })();
      keys.sort();
      for (_i = 0, _len = keys.length; _i < _len; _i++) {
        key = keys[_i];
        outputer({
          stdout: key + '=' + env[key] + '\n'
        });
      }
      outputer({
        code: 0
      });
      return;
    }
    if (command.args.length === 1) {
      value = command.env[command.args[0]];
      if (value != null) {
        outputer({
          stdout: command.args[0] + '=' + value + '\n'
        });
      } else {
        outputer({
          stdout: command.args[0] + ' no value\n'
        });
      }
      outputer({
        code: 0
      });
      return;
    }
    if (__indexOf.call(command.args, '-h') >= 0) {
      outputer({
        stdout: "Usage: setenv NAME VALUE"
      });
      outputer({
        code: 0
      });
      return;
    }
    console.env(command.args[0], command.args[1]);
    return outputer({
      code: 0
    });
  });
  commandSet.add('clear', function(command, outputer, console) {
    console.clearConsole();
    return outputer({
      code: 0
    });
  });
  commandSet.add('', function(command, outputer, console) {
    return outputer({
      code: 0
    });
  });
  commandSet.addFilter('ls', null, {
    complete: false,
    filterStdout: function(callback, command, data) {
      var line, lines, parts, result, _i, _len, _results;
      lines = data.split(/\n/);
      _results = [];
      for (_i = 0, _len = lines.length; _i < _len; _i++) {
        line = lines[_i];
        if (!line) {
          continue;
        }
        result = $('<span class="file"></span>');
        parts = parseLs(line);
        result.attr(parts);
        result.text(parts.filename);
        callback(result);
        _results.push(callback($('<br>')));
      }
      return _results;
    },
    changeCommand: function(command) {
      return command.args.push('-l');
    }
  });
  getMatch = function(regex, line) {
    var m, rest;
    m = regex.exec(line);
    if (m) {
      rest = line.substr(m.index + m[0].length);
      rest = rest.replace(/^\s+/, '');
      return [m[0], rest];
    } else {
      return [null, line];
    }
  };
  parseLs = function(line) {
    var huh, m, rest, results, _ref, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
    results = {};
    _ref = getMatch(/[drwx-]+/, line), results.perms = _ref[0], rest = _ref[1];
    _ref2 = getMatch(/\d+/, rest), huh = _ref2[0], rest = _ref2[1];
    _ref3 = getMatch(/[a-zA-Z][a-zA-Z0-9_-]*/, rest), results.user = _ref3[0], rest = _ref3[1];
    _ref4 = getMatch(/[a-zA-Z][a-zA-Z0-9_-]*/, rest), results.group = _ref4[0], rest = _ref4[1];
    _ref5 = getMatch(/[0-9]+[MKG]?/, rest), results.size = _ref5[0], rest = _ref5[1];
    _ref6 = getMatch(/\d\d\d\d-\d\d-\d\d/, rest), results.date = _ref6[0], rest = _ref6[1];
    _ref7 = getMatch(/\d\d:\d\d/, rest), results.time = _ref7[0], rest = _ref7[1];
    if (rest.search(/->/) !== -1) {
      m = /^(.*)\s+->\s+(.*)$/.exec(rest);
      results.symlink = m[1];
      rest = m[2];
    }
    results.filename = rest;
    return results;
  };
}).call(this);
