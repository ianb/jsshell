JSShell
=======

.. toc:::

I was thinking about shells, like good ol' bash, and while they fit a
certain purpose they aren't necessarily the best way to interact with
files.  They aren't very *modern*, and they are very heavily burdened
with legacy.

I'd already been thinking about a terminal in the browser (part of a
general thought I've had: why do I use any app except a browser?) --
but a terminal emulator always seemed kind of wonky and unexciting.
What if the *shell* itself was in the client?

The browser can't actually run programs (well, without an extension),
so I have a small Node.js program (``server.coffee``) that serves that
purpose, as well as serving up the static files needed by the client.
But the server is not itself a shell -- it's more like a JSON/JSONP
wrapper for ``execvpe``.  It has no context or state, it just runs
things.  All the context is held in the client.

Moving state to the client itself also interests me.  In fact very
little is left over when you run a program.  Its environmental
variables are created then thrown away.  It has a PID, but that too is
meaningless when the program completes.  It might write files.  It
might output *text*, but the text doesn't *live* on the console, it's
just text (ignoring for now all interactive terminal programs).  So
you don't need something like ``screen`` to restart a session -- you
can store the whole thing in ``localStorage`` to the same effect!

The Name
--------

I should probably change it, JSShell is (over) used already, generally
for things entirely unrelated to this project.  Clever ideas welcome
(though I also kind of like boring/clear ideas too).

The Shell Itself
----------------

The shell is currently simple, but does wildcard expansion, ``~``
expansion, variable expansion, and ``$()`` interpolation.  While I
want to keep the basic flavor of bash/sh, I don't feel a need to
replicate its quirks and pitfalls... but still I don't want to mess up
everyone's finger memory (I have enough of it myself).

The shell doesn't evaluate simply to a list of strings, instead it
creates an AST (``parser.js:Node``).  Various interpolations are done
through substitutions in the AST.  Only at the last moment when
running a command is it turned into a list of strings (which is the
only way to run commands -- the one fixed API we must conform to).  I
hope to use this to avoid problems with embedded spaces in filenames
(i.e., treat filenames as unsplittable strings).  Also it means you
can have real data structures like arrays.  I haven't made much use of
this (sometimes it's just *wrong* right now), but I am hoping it will
be useful.

Also I plan on allowing Javascript-side filtering of both input and
output, so that things like ``ls`` can be prettied up (e.g., making
filenames links).  And just generally allowing for nice UI around the
shell experience.

Pipes, Background Jobs, etc
---------------------------

I am honestly not sure how to handle these.  At this exact moment
*everything* is a background job.  Pipes aren't supported at all.
Probably pipes should be executed on the server, to avoid
round-tripping to the client.

CoffeeScript
------------

This is actually all written in `CoffeeScript
<http://jashkenas.github.com/coffee-script/>`_, not Javascript.
There's a script ``run.sh`` that both starts Node and starts
coffeescript so it will recompile everything as it is edited; this is
nice for development, except for figuring out line offsets in errors
it makes it almost seem like you are editing the native browser
language.

I've checked in the ``.js`` files so you can still run this without
CoffeeScript installed.

Interactive/Terminal programs
-----------------------------

Some programs interact with the screen more fully than to just dump
text.  Those programs aren't supported at all.  I want them all to be
replicated in the browser anyway (e.g., through an in-browser
editor).

Discussion
----------

I dunno.  Maybe find me on ``#labs`` on irc.mozilla.org.  I'm just
messing around with this right now, I don't know where it'll go.
