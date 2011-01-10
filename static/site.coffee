window.scroller = scroller = null

$( () ->

  if $('#main-console').length
    mainConsole = window.mainConsole = new Console($('#main-console'))
    mainConsole.restore()
    mainConsole.focus()
    $('#main-console').click(->
      mainConsole.focus()
    )

)

processEnv = null

$.ajax
  url: '/env',
  dataType: 'json',
  success: (result) ->
    processEnv = result


class Command

  constructor: (command, args, cwd, env) ->
    this.command = command
    this.args = args
    this.cwd = cwd
    this.env = env

  runCommand: (callbackInfo) ->
    if commandSet.has(this)
      nextId = splitId(callbackInfo.id)[1]
      commandSet.run(this, ((data) -> callbackInfo.console.boundReceiver(nextId, data)), callbackInfo.console)
      callbackInfo.console.scroller.reinitialise()
      callbackInfo.console.scroller.scrollToBottom()
    else
      data = {
        callbackId: JSON.stringify(callbackInfo.id || 0),
        callback: callbackInfo.name,
        command: this.command,
        args: JSON.stringify(this.args),
        cwd: this.cwd,
        env: JSON.stringify(this.env),
      }
      this.sendCommand(data)

  sendCommand: (data) ->
    s = document.createElement('script')
    s.setAttribute 'type', 'text/javascript'
    params = ((name + '=' + encodeURIComponent(data[name])) for name of data).join('&')
    s.setAttribute 'src', '/call?' + params
    document.getElementsByTagName('head')[0].appendChild(s)

  getOutput: (callback) ->
    stdout = ''
    stderr = ''
    receiver = (id, data) ->
      if data.stdout
        stdout += data.stdout
      if data.stderr
        stderr += data.stderr
      if data.code?
        delete dataReceiver.receivers[callbackId]
        callback(stdout, stderr)
    if commandSet.has(this)
      ## FIXME: mainConsole?
      commandSet.run(this, ((data) -> receiver(null, data)), mainConsole)
    else
      callbackId = genSym()
      dataReceiver.receivers[callbackId] = receiver
      data = {
        callbackId: JSON.stringify(callbackId),
        callback: 'dataReceiver',
        command: this.command,
        args: JSON.stringify(this.args),
        cwd: this.cwd,
        env: JSON.stringify(this.env),
      }
      this.sendCommand(data)

class Console

  constructor: (el) ->
    this.el = el
    this.scroller = null
    this.callbackId = genSym()
    this.boundReceiver = (id, data) =>
      this.dataReceived(id, data)
    dataReceiver.receivers[this.callbackId] = this.boundReceiver
    $('input.input', this.el).bind(
      'keyup',
      (event) =>
        this.inputKeyup(event)
    )
    this.scroller = $('.scroll-pane', this.el).jScrollPane().data('jsp')
    this.homeCache = {}
    this.history = []
    this.historySearch = null
    this.historyPos = null
    this.persister = new Persister()
    this.persistId = null
    this.persistRestored = false

  persistSoon: (time=1000) ->
    if not this.persistId?
      this.saverId = setTimeout((=> this.persist()), time)

  focus: ->
    $('input.input', this.el).focus()

  write: (output, type='stdout', id) ->
    # Write text to the output
    el = $('<span>')
    el.addClass(type)
    el.text(output)
    this.writeEl(el, id)

  writeEl: (el, id) ->
    if id
      container = $('#' + id, this.el)
    else
      container = $('.output', this.el)
    container.append(el)
    this.scroller.reinitialise()
    this.scroller.scrollToBottom()
    this.persistSoon()

  cwd: (dir) ->
    # Get (or set) the current working directory
    if dir?
      dir = normpath(pathjoin(this.cwd(), dir))
      els = $('.meta .cwd', this.el)
      if not els.length
        newEl = $('<div>cwd: <span class="cwd"></span></div>')
        $('.meta', this.el).append(newEl)
        cwdEl = $('.cwd', newEl)[0]
      else
        cwdEl = els[els.length-1]
      $(cwdEl).text(dir)
      this.persist()
      return dir
    else
      els = $('.meta .cwd', this.el)
      if not els.length
        return '/'
      return $(els[els.length-1]).text()

  env: (name, value) ->
    # Get the entire env, just one var (if you give a name), or
    # set a value with both name and value, or with an object name
    if typeof name == 'object'
      $('.meta .envs .setting').remove()
      for setName, value of name
        this.env(setName, value)
    else if value != undefined
      # setenv
      els = $('.meta .envs .setting', this.el)
      if value == null
        for el in els
          if $('.name', el).text() == name
            el.remove()
            return
      else
        for el in els
          if $('.name', el).text() == name
            # Need to make a change
            $('.value', el).text(value)
            return
        parent = $('.meta .envs')
        v = $('<span class="setting"><span class="name"></span>=<span class="value"></span></span>')
        $('.name', v).text(name)
        $('.value', v).text(value)
        parent.append(v)
      this.persist()
      return value
    else
      els = $('.meta .envs .setting', this.el)
      result = {}
      for el in els
        n = $('.name', el).text()
        v = $('.value', el).text()
        result[n] = v
      if name?
        return result[name]
      return result

  clearConsole: ->
    $('.command-set, .incomplete-command-set', this.el).remove()
    this.scroller.reinitialise()
    this.scroller.scrollToBottom()
    this.persist()

  ## UI-related routines:

  inputKeyup: (event) ->
    if event.type != 'keyup'
      return
    if event.which == 13
      # Enter
      this.runInputCommand()
      return false
    if event.which == 38
      # Up arrow
      if not this.historyPos?
        this.historyPos = this.history.length
      this.historyPos--
      this.historyPos = 0 if this.historyPos < 0
      inputEl = $('input.input', this.el)
      inputEl.val(this.history[this.historyPos])
      return false
    if event.which == 40
      # Down arrow
      if not this.historyPos?
        # If you haven't gone into history, down arrow doesn't mean anything
        # (Though it could mean expand into textarea?)
        return false
      this.historyPos++
      this.historyPos = this.history.length if this.historyPos > this.history.length
      inputEl = $('input.input', this.el)
      inputEl.val(this.history[this.historyPos])
      return false
    if event.which == 82 and event.altKey
      # alt-R
      return false

  runInputCommand: ->
    inputEl = $('input.input', this.el)
    input = inputEl.val()
    this.history.push(input)
    this.historyPos = null
    this.historySearch = null
    inputEl.val('')
    div = $('<div class="incomplete-command-set"></div>')
    sym = 'cmd-output-' + genSym()
    div.attr id: sym
    cmdLine = $('<span class="cmd-line"><span class="cmd"></span> <br />')
    cmd = $('.cmd', cmdLine)
    div.append(cmdLine)
    node = parse(input)
    ## This is going to become async: :(
    node.toArgs(
      ((node) =>
        display = node.toCommand()
        cmd.text(display)
        #cmd.attr(title: node.toXML())
        this.writeEl(div)
        parts = node.toArgsNoInterpolate()
        command = new Command(parts[0], parts[1...], this.cwd(), this.env())
        command.runCommand(
          callback: this.boundReceiver,
          id: this.callbackId + '.' + sym,
          name: 'dataReceiver',
          console: this,
        )
        this.persist()
      ),
      ((node, callback) =>
        user = node.user
        if user of this.homeCache
          callback(this.homeCache[user])
          return
        if not user
          # Means the current user
          callback(processEnv['HOME'])
          return
        getHomeDir(
          ((dir) =>
            this.homeCache[user] = dir
            callback(dir)
          ),
          user,
          this.cwd(),
          this.env(),
        )
      ),
      ((node, callback) =>
        console.log 'substituting', node.toCommand()
        name = node.stringContents()
        callback(this.env(name))
      ),
      ((node, callback) =>
        args = node.toArgsNoInterpolate()
        command = new Command(args[0], args[1...], this.cwd(), this.env())
        command.getOutput(
          (stdout, stderr) =>
            if stderr
              this.write(stderr, 'stderr')
            callback(stdout)
        )
      ),
      ((node, callback) =>
        console.log 'wildcarding', node.toCommand()
        pattern = node.stringContents()
        expandWildcard(
          ((doc) ->
            callback(doc)),
          pattern,
          this.cwd(),
          this.env(),
        )
      ),
    )

  persist: ->
    if not this.persistRestored
      return
    if this.persistId
      cancelTimeout(this.persistId)
      this.persistId = null
    p = this.persister
    p.save('html', $('.output', this.el).html())
    p.save('history', this.history)
    p.save('cwd', this.cwd())
    p.save('env', this.env())

  restore: ->
    p = this.persister
    $('.output', this.el).html(p.get('html', ''))
    this.history = p.get('history', [])
    this.cwd(p.get('cwd', '/'))
    this.env(p.get('env', {}))
    this.scroller.reinitialise()
    this.scroller.scrollToBottom()
    this.persistRestored = true

  dataReceived: (id, data) ->
    console.log 'data', id, data
    if data.stdout? or data.stderr?
      if data.stdout?
        cls = 'stdout'
      else
        cls = 'stderr'
      this.write(data.stdout || data.stderr, cls, id)
      # Ignore the other stuff
    if data.code? and id
      el = $('#' + id, this.el)
      el.removeClass('incomplete-command-set')
      el.addClass('command-set')
      el = $('.cmd', el)
      if el.attr('title').search(/pid/) != -1
        title = el.attr('title')
        title = title.replace(/pid\:\s*\d+\s*/, '')
        el.attr('title', title)
      this.persistSoon()
    if data.pid? and id
      el = $('.cmd', $('#' + id, this.el))
      console.log 'el', el
      el.attr(title: 'pid: ' + data.pid + ' ' + el.attr('title'))

expandWildcard = (callback, pattern, cwd, env) ->
  base = pattern
  wildcard = ''
  loop
    if base.indexOf('*') != -1
      # Means we need to pop something off into wildcard
      [base, pat] = splitpath(base)
      if wildcard
        wildcard = pat + '/' + wildcard
      else
        wildcard = pat
    else
      break
  base ||= '.'
  console.log 'wildcarding', base, wildcard
  command = new Command('find', [base, '-maxdepth', '1', '-wholename', wildcard, '-print0'], cwd, env)
  command.getOutput(
    ((stdout, stderr) ->
      files = stdout.split('\u0000')
      console.log 'result', stdout, files
      doc = new Node('span')
      for file in files
        if file.substr(0, 2) == './'
          file = file.substr(2)
        doc.push(new Node('arg', null, file))
        doc.push(' ')
      callback(doc)
    )
  )

getHomeDir = (callback, user, cwd, env) ->
  command = new Command('python', ['-c', 'import pwd, sys; print pwd.getpwnam(sys.argv[1]).pw_dir', user], cwd, env)
  command.getOutput(
    ((stdout, stderr) ->
      callback(stdout)
    )
  )


genSym = ->
  return 'sym' + (++arguments.callee.counter);
genSym.counter = 0;

window.dataReceiver = dataReceiver = (id, data) ->
  ## Generally dispatches the data to... someone (according to the id)
  [curId, nextId] = splitId(id)
  receiver = arguments.callee.receivers[curId]
  receiver(nextId, data)

splitId = (id) ->
  if id.indexOf('.') != -1
    return [id.substr(0, id.indexOf('.')), id.substr(id.indexOf('.')+1)]
  else
    return [id, null]

dataReceiver.receivers = {}

class Persister
  constructor: (storage) ->
    if not storage?
      storage = window.localStorage
    this.storage = storage

  save: (key, value) ->
    if v == null
      this.storage.removeItem(key)
    else
      v = JSON.stringify(value)
      this.storage.setItem(key, v)

  get: (key, defaultValue=null) ->
    v = this.storage.getItem(key)
    if v?
      return JSON.parse(v)
    else
      return defaultValue
