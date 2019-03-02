#!/usr/bin/env node

/**
 * Module dependencies.
 */
const debug = require('debug')('webchat:server');
const http = require('http');
const config = require('./config/config');
const logger = require('./log').getLogger(config.log_categories);

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const _logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const session = require('express-session');
// 本地的FileStore保存session在windows上会有严重的EPERM错误
// 建议在windows上使用redis保存session，linux或MacOS上两者皆可
// const FileStore = require('session-file-store')(session);
const RedisStore = require('connect-redis')(session);



/**
 * Module exports.
 * @module www服务器模块
 */
module.exports = WWW;

function WWW(opts, socketServer) {
    if (!(this instanceof WWW)) return new WWW(opts, socketServer);
    this.opts = opts;
    this.port = opts.LISTEN_PORT;
    this.socketServer = socketServer;
    this.initWww();
}

WWW.prototype.initWww = function() {

    /**
     * Create HTTP server.
     */
    const app = express();

    // session login user key
    const loginUserKey = this.opts.session.LOGIN_USER_KEY;

    // all user
    const users = this.opts.users;

    // set port
    app.set('port', this.port);
    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');

    // 修改图标（左上角的图标）
    // uncomment after placing your favicon in /public
    //app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

    // www服务器日志调试
    // app.use(_logger('dev'));

    // session配置
    app.use(session({
        name: this.opts.session.NAME,
        secret: this.opts.session.SECRET,
        // store: new FileStore(),  // 本地存储session（文本文件，也可以选择其他store，比如redis的）
        store: new RedisStore(this.opts.session.REDIS_CONFIG),
        saveUninitialized: this.opts.session.SAVE_UNINITIALIZED,
        resave: this.opts.session.RE_SAVE,
        cookie: {
            maxAge: this.opts.session.MAX_AGE
        }
    }));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    /**
     * 进入后台所有的页面都会先检查是否已经登录
     */
    app.use(function(req, res, next) {
        // 不是登录页面的请求并且session中没有身份验证信息，则跳转到登录页面
        if (req.path.indexOf("/login") < 0 && !req.session[loginUserKey]) {
            res.redirect("/login");
        } else {
            next();
        }
    });

    /**
     * 进入登录页面
     */
    app.get("/login", function(req, res) {
        res.render("login");
    });

    /**
     * 用户登录
     */
    app.post("/login", function(req, res) {
        let body = req.body;
        // 验证用户名和密码
        if (checkUser(body.username, body.password, users)) {
            req.session[loginUserKey] = body.username;
            res.redirect("/");
        } else {
            res.render("login", { errorMsg: "用户名或密码错误!"});
        }
    });

    /**
     * 退出登录（注销）
     */
    app.get("/logout", function(req, res) {
        delete req.session[loginUserKey];
        res.redirect("/login");
    });

    // 配置路由
    const index = require('./routes/index')(this.socketServer);
    // const users = require('./routes/users');
    app.use('/', index);
    // app.use('/login', users);

    /**
     * 404页面（当没有找到页面时，则要跳转的页面）
     */
    app.get('*', function(req, res) {
        let err = new Error('页面走丢了');
        err.status = 404;
        res.locals.message = err.message;
        // 此行为调试时所用的
        res.locals.error = req.app.get('env') === 'development' ? err : {};
        return res.render('error');
    });

/*    // catch 404 and forward to error handler
    app.use(function(req, res, next) {
        let err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    // error handler
    app.use(function(err, req, res, next) {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};

        // render the error page
        return res.status(err.status || 500).render('error');
    });*/

    this.server = http.createServer(app);
};


WWW.prototype.start = function() {
    /**
     * Listen on provided port, on all network interfaces.
     */
    this.server.listen(this.port);
    this.server.on('error', (error) => this.onError(error));
    this.server.on('listening', () => this.onListening);
    let host = this.server.address().address;
    let port = this.server.address().port;
    logger.info("www服务器开启成功[http://%s:%s]。", host, port);
};

/**
 * 验证用户名和密码
 * @param username  用户名
 * @param password  密码
 * @param users     全部可登录的用户
 * @return  成功则返回用true失败返回false
 */
function checkUser(username, password, users) {
    for (let n in users) {
        if (users[n].username === username && users[n].password === password) {
            return true;
        }
    }
    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

WWW.prototype.onError = function(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  let bind = typeof this.port === 'string'
    ? 'Pipe ' + this.port
    : 'Port ' + this.port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
};

/**
 * Event listener for HTTP server "listening" event.
 */

WWW.prototype.onListening = function() {
  let addr = this.server.address();
  let bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
};
