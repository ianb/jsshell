(function() {
  var envProgram, fs, http, jsonpRunProgram, mainServer, nullString, path, requestJSON, serveStatic, spawn, sys, url;
  sys = require('sys');
  http = require('http');
  path = require('path');
  fs = require('fs');
  url = require('url');
  spawn = require('child_process').spawn;
  nullString = (new Buffer([0])).toString();
  requestJSON = function(req, func) {
    var allData;
    allData = '';
    req.on('data', function(data) {
      return allData += data;
    });
    return req.on('end', function() {
      var reqBody;
      reqBody = JSON.parse(allData);
      return func(reqBody);
    });
  };
  jsonpRunProgram = function(req, res) {
    var args, callback, callbackId, cwd, env, name, params, proc, sendData, value, _ref;
    params = url.parse(req.url, true).query;
    cwd = params.cwd;
    env = process.env;
    if (params.env) {
      _ref = JSON.parse(params.env);
      for (name in _ref) {
        value = _ref[name];
        if (value === null) {
          delete env[name];
        } else {
          env[name] = value;
        }
      }
    }
    args = params.args ? JSON.parse(params.args) : [];
    callback = params.callback;
    callbackId = params.callbackId ? JSON.parse(params.callbackId) : null;
    console.log('args', JSON.stringify([
      params, params.command, args, {
        cwd: cwd,
        env: params.env
      }
    ]));
    proc = spawn(params.command, args, {
      cwd: cwd,
      env: env
    });
    res.writeHead(200, {
      'Content-Type': 'text/javascript'
    });
    sendData = function(data) {
      return res.write(callback + '(' + JSON.stringify(callbackId) + ', ' + JSON.stringify(data) + ')\n');
    };
    sendData({
      pid: proc.pid
    });
    res.write('\n');
    proc.stdout.on('data', function(data) {
      return sendData({
        stdout: data.toString()
      });
    });
    proc.stderr.on('data', function(data) {
      return sendData({
        stderr: data.toString()
      });
    });
    return proc.on('exit', function(code, signal) {
      sendData({
        code: code
      });
      return res.end();
    });
  };
  envProgram = function(req, res) {
    res.writeHead(200, {
      'Content-Type': 'application/json'
    });
    return res.end(JSON.stringify(process.env));
  };
  serveStatic = function(req, res) {
    var filename, p;
    p = url.parse(req.url).pathname;
    if (!p || p === "/") {
      p = "/index.html";
    }
    filename = path.join(process.cwd(), 'static', p);
    return path.exists(filename, function(exists) {
      if (!exists) {
        res.writeHead(404, {
          "Content-Type": "text/plain"
        });
        res.end("404 Not Found\n");
        return;
      }
      return fs.readFile(filename, "binary", function(err, file) {
        if (err) {
          res.writeHead(500, {
            "Content-Type": "text/plain"
          });
          res.write(err + "\n");
          return;
        }
        res.writeHead(200);
        return res.end(file, "binary");
      });
    });
  };
  mainServer = function(req, res) {
    var p;
    p = url.parse(req.url).pathname;
    if (req.method === 'POST') {
      return xhrRunProgram(req, res);
    } else if (p === '/call') {
      return jsonpRunProgram(req, res);
    } else if (p === '/env') {
      return envProgram(req, res);
    } else {
      return serveStatic(req, res);
    }
  };
  http.createServer(mainServer).listen(8000);
}).call(this);
