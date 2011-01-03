BACKSLASH_SPECIAL = {
  "n": "\n",
  "r": "\r",
  "t": "\t",
}
## FIXME: should include \x00 etc

WHITESPACES = {
  " ": null,
  "\n": null,
  "\r": null,
  "\t": null,
}

class Node
  constructor: (t, attrs, children) ->
    this.t = t
    if attrs?
      this[name] = value for own name, value of attrs
    if children?
      if not typeof children == 'string' and not children.length
        this.c = [children]
      else
        this.c = children
    else
      this.c = ''

  toXML: ->
    s = '<' + this.t
    for own name of this
      if name == 't' or name == 'c' or this[name] == null
        continue
      s += ' ' + name + '="' + this._quote(this[name]) + '"'
    if not this.c
      s += ' />'
      return s
    s += '>'
    if typeof this.c == 'string'
      s += this._quote(this.c)
    else
      for item in this.c
        if typeof item == 'string'
          s += this._quote(item)
        else
          s += item.toXML()
    s += '</' + this.t + '>'
    return s

  _quote: (s) ->
    if s == true
      return '1'
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('"', '&quot;')

  pushString: (s) ->
    if typeof this.c == 'string'
      this.c += s
    else if typeof this.c[this.c.length-1] == 'string'
      this.c[this.c.length-1] = this.c[this.c.length-1] + s
    else
      this.c.push(s)

  push: (node) ->
    if typeof node == 'string'
      this.pushString(node)
    else if typeof this.c == 'string'
      this.c = [this.c, node]
    else
      this.c.push(node)

  lastChildNode: ->
    if typeof this.c == 'string'
      return null
    else if typeof this.c[this.c.length-1] == 'string'
      return null
    else
      return this.c[this.c.length-1]

  toCommand: ->
    if this.t == 'arg' or this.t == 'span'
      return this.toCommandChildren()
    else if this.t == 'string'
      if this.quote == 'double'
        return '"' + this.toCommandChildren() + '"'
      else if this.quote == 'single'
        return "'" + this.toCommandChildren() + "'"
      else
        return this.toCommandChildren()
    else if this.t == 'var'
      if this.bracketed
        return '${' + this.toCommandChildren() + '}'
      else
        return '$' + this.toCommandChildren()
    else if this.t == 'interpolate'
      if this.backtick
        return "`" + this.toCommandChildren() + "`"
      else
        return "$(" + this.toCommandChildren() + ")"
    else if this.t == 'backslash'
      if this.name
        return '\\' + this.name
      else
        return '\\' + this.toCommandChildren()
    else if this.t == 'wildcard'
      return this.toCommandChildren()
    else if this.t == 'homedir'
      return this.toCommandChildren()
    else
      throw 'unknown type: ' + this.t

  toCommandChildren: ->
    if typeof this.c == 'string'
      return this.c
    s = ''
    for item in this.c
      if typeof item == 'string'
        s += item
      else
        s += item.toCommand()
    return s

  expander: (callback, type, expander, parent, tracker) ->
    tracker ?= {count: 0, any: false, finished: false, callbackCalled: false}
    if not parent? and this.t == type
      throw 'Cannot substitute the parent itself ('+this.t+')'
    if this.t == type
      tracker.count++
      tracker.any = true
      expander(this, (replacement) =>
        tracker.count--
        parent.substituteChild(this, replacement)
        if not tracker.count and tracker.finished and not tracker.callbackCalled
          tracker.callbackCalled = true
          callback()
      )
    else if typeof this.c != 'string'
      for item in this.c
        if typeof item != 'string'
          item.expander(callback, type, expander, this, tracker)
    if not parent?
      # The top is responsible for managing the finish
      tracker.finished = true
      if not tracker.any
        callback()
      else if not tracker.count and not tracker.callbackCalled
        tracker.callbackCalled = true
        callback()

  substituteChild: (child, replacement) ->
    newC = []
    if typeof this.c == 'string'
      # Huh, this shouldn't happen...
      this.c = [this.c]
    for item in this.c
      if item == child
        item = replacement
      newC.push(item)
    this.c = newC

  toArgs: (callback, homedirs, vars, interpolator, wildcarder) ->
    if homedirs?
      this.expander(
        (() =>
          this.toArgs(callback, null, vars, interpolator, wildcarder)),
        'homedir',
        homedirs
      )
      return
    if vars?
      this.expander(
        (() =>
          this.toArgs(callback, null, null, interpolator, wildcarder)),
        'var',
        vars
      )
      return
    if interpolator?
      this.expander(
        (() =>
          this.toArgs(callback, null, null, null, wildcarder)),
        'interpolate',
        interpolator
      )
      return
    if wildcarder?
      this.expander(
        (() =>
          this.toArgs(callback, null, null, null, null)),
        'wildcard',
        wildcarder
      )
      return
    # What do args inside args mean?  Just space-separate?
    callback(this)

  toArgsNoInterpolate: (args) ->
    args = args || []
    if this.t != 'arg'
      for node in this.c
        node.toArgsNoInterpolate(args) if typeof node != 'string'
    else
      args.push(this.stringContents())
    return args

  stringContents: ->
    s = ''
    for c in this.c
      if typeof c == 'string'
        s += c
      else
        s += c.stringContents()
    return s

window.Node = Node

class Point
  constructor: (s) ->
    this.s = s
    this.pos = 0
    this.watchFor = []

  watched: (s) ->
    for item in this.watchFor
      if item == null
        return false
      if item == s
        return true
    return false

  addWatched: (s) ->
    this.watchFor.push(s)

  removeWatched: (s) ->
    if this.watchFor[this.watchFor.length-1] == s
      this.watchFor.splice(this.watchFor.length-1, 1)
    else
      throw 'Unexpected removeWatched(' + s + ')'

  quotestate: (set) ->
    if set == 'pop'
      this.quotestates.splice(this.quotestates.length-1, 1)
    else if set != undefined
      this.quotestates.push(set)
      return set
    if this.quotestates.length
      return this.quotestates[this.quotestates.length-1]
    else
      return null

  peek: ->
    return this.s.charAt(this.pos)

  peekNext: ->
    return this.s.charAt(this.pos+1)

  advance: ->
    this.pos += 1
    return this

  atEnd: ->
    return this.pos >= this.s.length

  toString: ->
    return this.s.substr(0, this.pos) + '(*)' + this.s.substr(this.pos)

window.Point = Point

window.parse = parse = (s) ->
  doc = new Node('span', incomplete: 1)
  point = new Point(s)
  _parseArgs(point, doc)
  delete doc.incomplete
  return doc

_parseArgs = (point, doc) ->
  # Parse args:
  #   Eat whitespace (more or less)
  #   When we see non-whitespace, start an arg
  loop
    if point.atEnd()
      return
    c = point.peek()
    if c of WHITESPACES
      doc.pushString(c)
      point.advance()
    else if point.watched(c)
      return
    else
      arg = new Node('arg', incomplete: true)
      doc.push(arg)
      _parseArg(point, arg, false)

_parseArg = (point, arg, quoted) ->
  # Parse one arg:
  #   Keep going until we get an unquoted whitespace character
  promoteWildcard = false
  loop
    if point.atEnd()
      delete arg.incomplete
      break
    c = point.peek()
    if not quoted and c of WHITESPACES
      delete arg.incomplete
      break
    if point.watched(c)
      delete arg.incomplete
      break
    if not quoted and c == "*"
      promoteWildcard = true
    if not quoted and c == "'"
      s = new Node('string', quote: "single", incomplete: true)
      arg.push(s)
      _parseSingleQuote(point.advance(), s)
    else if c == '"'
      if quoted
        delete arg.incomplete
        point.advance()
        break
      else
        s = new Node('string', quote: "double", incomplete: true)
        arg.push(s)
        _parseArg(point.advance(), s, true)
    else if c == '\\'
      point.advance()
      quoted = point.peek()
      if quoted == ""
        # End of string
        b = new Node('backslash', {incomplete: 1}, '\\')
        arg.push(b)
        # Leave container incomplete too
        break
      point.advance()
      if quoted of BACKSLASH_SPECIAL
        newChar = BACKSLASH_SPECIAL[quoted]
        name = quoted
      else
        name = null
        newChar = quoted
      b = new Node('backslash', {name: name}, newChar)
      arg.push(b)
    else if c == '$'
      point.advance()
      c = point.peek()
      if c == ""
        # End of string
        # Signal error?
        arg.pushString(s)
        break
      else if c == '('
        i = new Node('interpolate', incomplete: true)
        arg.push(i)
        _parseInterpolate(point.advance(), i)
      else if c == '{'
        v = new Node('var', bracketed: true, incomplete: true)
        arg.push(v)
        _parseVar(point.advance(), v)
      else
        v = new Node('var', incomplete: true)
        arg.push(v)
        _parseVar(point, v)
    else if c == "`"
      i = new Node('interpolate', backtick: true, incomplete: true)
      arg.push(i)
      _parseInterpolate(point.advance(), i)
    else
      arg.pushString(c)
      point.advance()
  checkTilde = arg
  if promoteWildcard
    w = new Node('wildcard')
    w.c = arg.c
    arg.c = [w]
    checkTilde = w
  if typeof checkTilde.c == 'string'
    value = checkTilde.c
  else
    value = checkTilde.c[0]
  if not quoted and value and typeof value == 'string' and value.charAt(0) == '~'
    match = /^~([a-z0-9_.-]*)(.*)/.exec(value)
    user = match[1] || null
    rest = match[2]
    u = new Node('homedir', user: user)
    u.c = '~' + (user || '')
    if typeof checkTilde.c == 'string'
      checkTilde.c = [u]
      if rest
        checkTilde.c.push(rest)
    else
      checkTilde.c[0] = u
      if rest
        checkTilde.c.splice(1, 0, rest)

_parseInterpolate = (point, i) ->
  backticked = i.backtick
  if backticked
    point.addWatched('`')
  else
    point.addWatched(')')
  _parseArgs(point, i)
  c = point.peek()
  if c == ""
    # End of string, ignore but leave incomplete
    return
  if backticked and c == '`'
    # Excellent!
    point.removeWatched('`')
    point.advance()
    delete i.incomplete
  else if not backticked and c == ')'
    point.removeWatched(')')
    point.advance()
    delete i.incomplete
  else
    # Something unexpected
    # Do we signal errors?
    false

_parseVar = (point, v) ->
  bracketed = v.bracketed
  loop
    c = point.peek()
    if c == ""
      if not bracketed
        # Fine to end here
        delete v.incomplete
      break
    if bracketed
      if c == '}'
        point.advance()
        delete v.incomplete
        break
    else
      if not /[a-zA-Z0-9_]/.test(c)
        delete v.incomplete
        break
    v.pushString(c)
    point.advance()

_parseSingleQuote = (point, s) ->
  point.addWatched("'")
  loop
    c = point.peek()
    if c == ""
      break
    point.advance()
    if c == "'"
      delete s.incomplete
      break
    s.pushString(c)
  point.removeWatched("'")


