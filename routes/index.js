const express = require('express');
const router = express.Router();
const config = require('../config/config');

module.exports = Index;

function Index(socketServer) {

    // 进入首页页面
    router.get('/', function(req, res) {
        res.render('index', { title: '后台管理', username : req.session[config.www.session.LOGIN_USER_KEY]});
    });

    // 获取用户信息页面
    router.get('/userInfo', function(req, res) {
        res.render('userInfo', { title: '用户信息查看', userInfo: socketServer.getUserInfo(req.query.un) });
    });

    return router;
}



// module.exports = router;
