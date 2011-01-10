sys = require 'sys'
http = require 'http'
path = require 'path'
fs = require 'fs'
url = require 'url'
spawn = require('child_process').spawn

nullString = (new Buffer([0])).toString()

requestJSON = (req, func) ->
  allData = ''
  req.on 'data', (data) ->
    allData += data
  req.on 'end', () ->
    reqBody = JSON.parse(allData)
    func(reqBody)


jsonpRunProgram = (req, res) ->
  params = url.parse(req.url, true).query
  cwd = params.cwd
  env = process.env
  if params.env
    for name, value of JSON.parse(params.env)
      if value == null
        delete env[name]
      else
        env[name] = value
  args = if params.args then JSON.parse(params.args) else []
  callback = params.callback
  callbackId = if params.callbackId then JSON.parse(params.callbackId) else null
  console.log('args', JSON.stringify([params, params.command, args, {cwd: cwd, env: params.env}]))
  proc = spawn(params.command, args, {cwd: cwd, env: env})
  res.writeHead(200, 'Content-Type': 'text/javascript')
  sendData = (data) ->
    res.write(callback + '(' + JSON.stringify(callbackId) +
              ', ' + JSON.stringify(data) + ')\n')
  sendData(pid: proc.pid)
  res.write('\n')
  proc.stdout.on 'data', (data) ->
    sendData(stdout: data.toString())
  proc.stderr.on 'data', (data) ->
    sendData(stderr: data.toString())
  proc.on 'exit', (code, signal) ->
    sendData(code: code)
    res.end()


envProgram = (req, res) ->
  res.writeHead(200, 'Content-Type': 'application/json')
  res.end(JSON.stringify(process.env))


serveStatic = (req, res) ->
  p = url.parse(req.url).pathname
  if not p or p == "/"
    p = "/index.html"
  filename = path.join process.cwd(), 'static', p
  path.exists filename, (exists) ->
    if not exists
      res.writeHead 404, {"Content-Type": "text/plain"}
      res.end "404 Not Found\n"
      return

    fs.readFile filename, "binary", (err, file) ->
      if err
        res.writeHead 500, {"Content-Type": "text/plain"}
        res.write err + "\n"
        return

      res.writeHead 200
      res.end file, "binary"


mainServer = (req, res) ->
  p = url.parse(req.url).pathname
  if req.method == 'POST'
    xhrRunProgram(req, res)
  else if p == '/call'
    jsonpRunProgram(req, res)
  else if p == '/env'
    envProgram(req, res)
  else
    serveStatic(req, res)


http.createServer(mainServer).listen 8000
