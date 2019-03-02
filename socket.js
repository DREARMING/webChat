const io = require('socket.io')();
const _ = require('underscore');
const u = require('./utils')();
const config = require('./config/config');
const i18n = require('./config/i18n');
const mysql = require('./mysql')(config.mysql);
const logger = require('./log').getLogger(config.log_categories);

const msg = i18n.build(config.language);

/**
 * Module exports.
 * @module Socket.io服务器模块
 */
module.exports = SocketServer;

/**
 * 构造函数
 * @param opts  配置参数
 * @returns {SocketServer}
 * @constructor
 */
function SocketServer(opts) {
    if (!(this instanceof SocketServer)) return new SocketServer(opts);
    this.opts = opts;
    this.io = io;
    this.users = new Map();
    this.initServer();
}

// TEST
SocketServer.prototype.test = function() {
    return this.opts;
};

/**
 * 开启服务器
 */
SocketServer.prototype.start = function() {
    this.io.listen(this.opts.LISTEN_PORT);
    logger.info("Socket.io服务器开启成功[" + this.opts.LISTEN_PORT + "]。");
};

/**
 * 服务器初始化
 */
SocketServer.prototype.initServer = function() {
    this.io.on('connection', socket => {

        logger.debug(socket.handshake.query);
        /**
         * 登记用户信息
         */
        // 取出用户信息，如果没有用户信息则直接断开该socket的连接
        let userInfo = socket.handshake.query[this.opts.USER_INFO_KEY];
        if (!userInfo) { return socket.disconnect(true); }
        // 数据转换
        let data = handleData(userInfo);
        if (data === false) { return socket.disconnect(true); }
        // 取出用户名
        let username = data[this.opts.USER_KEY];
        if (!username) { return socket.disconnect(true); }
        // 如果user为空，则初始化一个(一个用户可以对应多个Socket)
        if (!this.users.get(username)) {
            this.users.set(username, []);
        }
        // 将用户名与该socket关联起来
        this.pushSocket(username, new Socket(socket.id));
        // 查询该用户信息是否已经存入数据库
        mysql.query("SELECT * FROM tb_user WHERE " + this.opts.USER_KEY + "=?", username, (error, results) => {
            if (error) { return socket.disconnect(true); }
            if (results.length !== 0) {
                // 已经存入数据库
                // 更新最后登录时间
                mysql.query("UPDATE tb_user SET " + this.opts.LOGIN_TIME_KEY + "=? WHERE " + this.opts.USER_KEY + "=?"
                    ,[new Date().toLocaleString(), username], (error) => {
                        if (error) { return socket.disconnect(true); }
                        // 查出该用户加入的群组，将该socket加入到对应的群组里面
                        mysql.query("SELECT " + this.opts.GROUP_KEY + " FROM tb_prelession_group_user_relation WHERE " + this.opts.USER_KEY + "=?", username,(error, results) => {
                            if (results.length === 0) { return; }
                            // 转换为数组形式
                            let rooms = [];
                            _.each(results, (ele) => {
                                if (ele[this.opts.GROUP_KEY]) {
                                    rooms.push(ele[this.opts.GROUP_KEY]);
                                }
                            });
                            // 加入room
                            socket.join(rooms, (err) => {
                                if (err) { return socket.disconnect(true); }
                            });
                        });
                    });
            } else {
                // 未存入数据库
                // 将用户信息放入数据库
                mysql.query("INSERT INTO tb_user(userId,username,nickname,avatar) VALUES(?,?,?,?)"
                    , [data.userId, data.username, data.nickname, data.avatar], (error) => {
                        if (error) { return socket.disconnect(true); }
                    });
            }
        });

        logger.info(username + "[" + socket.id + "]登记成功。");

        /**
         * 登记用户信息（弃用）
         */
/*        socket.on('send_user_info', (data, callback) => {
            // 判空与取出用户名
            if (!data) { return callback(config.ERROR); }
            data = handleData(data, callback);
            if (data === false) return;
            let username = data[this.opts.USER_KEY];
            if (!username) { return callback(config.ARG_ERROR); }
            // 如果user为空，则初始化一个(一个用户可以对应多个Socket)
            if (!this.users.get(username)) {
                this.users.set(username, []);
            }
            // 将用户名与该socket关联起来
            this.pushSocket(username, new Socket(socket.id));

            // 查询该用户信息是否已经存入数据库
            mysql.query("SELECT * FROM tb_user WHERE " + this.opts.USER_KEY + "=?", username, (error, results) => {
                if (error) { return callback(config.SQL_ERROR); }
                if (results.length !== 0) {
                    // 已经存入数据库
                    // 更新最后登录时间
                    mysql.query("UPDATE tb_user SET " + this.opts.LOGIN_TIME_KEY + "=? WHERE " + this.opts.USER_KEY + "=?"
                        ,[new Date().toLocaleString(), username], (error) => {
                            if (error) { return callback(config.SQL_ERROR); }
                            // 查出该用户加入的群组，将该socket加入到对应的群组里面
                            mysql.query("SELECT " + this.opts.GROUP_KEY + " FROM tb_prelession_group_user_relation WHERE " + this.opts.USER_KEY + "=?", username,(error, results) => {
                                if (results.length === 0) { return callback(config.SUCCESS);}
                                // 转换为数组形式
                                let rooms = [];
                                _.each(results, (ele) => {
                                    if (ele[this.opts.GROUP_KEY]) {
                                        rooms.push(ele[this.opts.GROUP_KEY]);
                                    }
                                });
                                // 加入room
                                socket.join(rooms, (err) => {
                                    if (err) { return callback(config.JOIN_ERROR); }
                                    callback(config.SUCCESS);
                                });
                            });
                        });
                } else {
                    // 未存入数据库
                    // 将用户信息放入数据库
                    mysql.query("INSERT INTO tb_user(userId,username,nickname,avatar) VALUES(?,?,?,?)"
                        , [data.userId, data.username, data.nickname, data.avatar], (error) => {
                        if (error) { return callback(config.SQL_ERROR); }
                        callback(config.SUCCESS);
                    });
                }
                logger.warn(this.users);
            });

            logger.info(username + "[" + socket.id + "]登记成功。");

        });*/

        /**
         * 断开连接
         */
        socket.on('disconnect', (reason) => {
            logger.info("[" + socket.id + "]断开连接 : " + reason);
        });


        socket.on('ack_msg', (data, callback) => {

        });

        socket.on('ack_notification', (data, callback) => {

        });

        /**
         * 发送聊天消息
         */
        socket.on('send_msg', (data, callback) => {
            logger.debug(data);
            // 判空与取出消息类型
            if (!data) { return callback(config.ERROR); }
            data = handleData(data, callback);
            if (data === false) return;
            let msgType = data[this.opts.MSG_TYPE_KEY];
            if (u.isEmpty(msgType)) { return callback(config.ARG_ERROR); }
            // 判断消息类型
            switch (msgType) {
                /**
                 * 文本或语音消息
                 */
                case this.opts.msgType.TEXT: case this.opts.msgType.VOICE:
                    // 取出发送类型和消息内容
                    let sendType = data[this.opts.SEND_TYPE_KEY];
                    // let content = data[this.opts.CONTENT_KEY];
                    if (u.isEmpty(sendType)) { return callback(config.ARG_ERROR); }
                    // 判断文本消息的发送类型
                    if (sendType === this.opts.sendType.SINGLE) {
                        // 单发
                        // 取出接受者username
                        let receiverName = data[this.opts.RECEIVER_KEY];
                        if (u.isEmpty(receiverName)) { return callback(config.ARG_ERROR); }
                        // 根据receiverName取出该用户下的所有socketId发送消息
                        let receiver = this.users.get(receiverName);
                        // 设置时间戳
                        data.sendTime = new Date().getTime();
                        // 将消息插入数据库，获取自增id
                        mysql.query("INSERT INTO tb_message SET ?", data, (error, results) => {
                            if (error) { return callback(config.SQL_ERROR); }
                            // 获取自增主键
                            data.msgId = results.insertId;
                            _.each(receiver, (ele) => {
                                // 发送前先判断对方是否上线
                                if (_.findWhere(this.io.sockets.sockets, {id: ele.id})) {
                                    socket.to(ele.id).emit("on_msg", data);
                                }
                                // 回调
                                callback(u.rsp(config.SUCCESS_CODE, data));
                            });
                        });
                    } else if (sendType === this.opts.sendType.MASS) {
                        // 群发
                        // 取出groupId和senderName，进行群发
                        let senderName = data[this.opts.SENDER_KEY];
                        let groupId = data[this.opts.GROUP_KEY];
                        if (u.isEmpty(groupId) || u.isEmpty(senderName)) { return callback(config.ARG_ERROR); }

                        // 检查用户是否在该群组内
                        mysql.query("SELECT COUNT(1) AS num FROM tb_prelession_group_user_relation WHERE username=? AND groupId=?",
                                    [senderName, groupId], (error, results) => {
                            if (error) { return callback(config.SQL_ERROR); }
                            if (results[0].num === 0) {
                                return callback(config.NOT_EXISTS_ERROR);
                            }
                            // 设置时间戳
                            data.sendTime = new Date().getTime();
                            // 将消息插入数据库，获取自增id
                            mysql.query("INSERT INTO tb_message SET ?", data, (error, results) => {
                                if (error) { return callback(config.SQL_ERROR); }
                                // 获取自增主键
                                data.msgId = results.insertId;
                                // 发送到群里
                                socket.to(groupId).emit("on_msg", data);
                                // logger.error(Object.keys(socket.rooms));
                                // logger.error(io.sockets.adapter.rooms[groupId]);
                                // 回调
                                callback(u.rsp(config.SUCCESS_CODE, data));
                            });
                        });
                    } else {
                        return callback(config.ARG_ERROR);
                    }
                    break;
                /**
                 * 进退群
                 */
                case this.opts.msgType.JOIN_LEAVE:
/*                    // 进退群
                    // 取出enterState、groupId和senderId
                    let enterState = data[this.opts.ENTER_STATE_KEY];
                    let groupId = data[this.opts.GROUP_KEY];
                    let senderId = data[this.opts.SENDER_KEY];
                    if (u.isEmpty(enterState) || u.isEmpty(groupId) || u.isEmpty(senderId)) {
                        return callback(config.ARG_ERROR);
                    }
                    // 判断是要进群还是退群
                    if (enterState === this.opts.enterState.JOIN) {
                        // 进群
                        mysql.query("INSERT INTO tb_prelession_group_user_relation SET ?"
                            , {groupId: groupId, userId: senderId, level: 0, state: 0 }
                            , (error) => {
                                if (error) {
                                    return callback(error.code === 'ER_DUP_ENTRY' ? config.ALREADY_EXISTS_ERROR : config.SQL_ERROR);
                                }
                                socket.join(groupId, (err) => {
                                    if (err) { return callback(config.JOIN_ERROR); }
                                    callback(config.SUCCESS);
                                });
                            });
                    } else if (enterState === this.opts.enterState.LEAVE) {
                        // 退群
                        mysql.query("DELETE FROM tb_prelession_group_user_relation WHERE groupId=? AND userId=?"
                            , [groupId, senderId]
                            , (error) => {
                                if (error) { callback(config.SQL_ERROR); }
                                socket.leave(groupId, (err) => {
                                    if (err) { return callback(config.ERROR); }
                                    callback(config.SUCCESS);
                                });
                            });
                    }*/
                    break;
                /**
                 * 群成员变更
                 */
                case this.opts.msgType.CHANGE:
                    // 群成员变更
                    break;
                default:
                    return callback(config.ARG_ERROR);
            }
        });


        /**
         * 发送通知
         */
        socket.on('send_notification', (data, callback) => {
            logger.debug(data);
            // 判空与取出数据
            if (!data) { return callback(config.ERROR); }
            data = handleData(data, callback);
            if (data === false) return;
            // 取出发送类型
            let sendType = data[this.opts.SEND_TYPE_KEY];
            if (u.isEmpty(sendType)) { return callback(config.ARG_ERROR); }
            // 判断文本消息的发送类型
            if (sendType === this.opts.sendType.SINGLE) {
                // 单发
                // 取出接收者username
                let receiverName = data[this.opts.RECEIVER_KEY];
                if (u.isEmpty(receiverName)) { return callback(config.ARG_ERROR); }
                // 根据receiverName取出该用户下的所有socketId发送通知
                let receiver = this.users.get(receiverName);
                // 设置时间戳
                data.sendTime = new Date().getTime();
                // 将通知插入数据库，获取自增id
                mysql.query("INSERT INTO tb_notification SET ?", data, (error, results) => {
                    if (error) { return callback(config.SQL_ERROR); }
                    // 获取自增主键
                    data.notificationId = results.insertId;
                    _.each(receiver, (ele) => {
                        // 发送前先判断对方是否上线
                        if (_.findWhere(this.io.sockets.sockets, {id: ele.id})) {
                            socket.to(ele.id).emit("on_notification", data);
                        }
                        // 回调
                        callback(u.rsp(config.SUCCESS_CODE, data));
                    });
                });
            } else if (sendType === this.opts.sendType.MASS) {
                // 群发
                // 取出groupId和senderName，进行群发
                let senderName = data[this.opts.SENDER_KEY];
                let groupId = data[this.opts.GROUP_KEY];
                if (u.isEmpty(groupId) || u.isEmpty(senderName)) { return callback(config.ARG_ERROR); }

                // 检查用户是否在该群组内
                mysql.query("SELECT COUNT(1) AS num FROM tb_prelession_group_user_relation WHERE username=? AND groupId=?",
                    [senderName, groupId], (error, results) => {
                        if (error) { return callback(config.SQL_ERROR); }
                        if (results[0].num === 0) {
                            return callback(config.NOT_EXISTS_ERROR);
                        }
                        // 设置时间戳
                        data.sendTime = new Date().getTime();
                        // 将通知插入数据库，获取自增id
                        mysql.query("INSERT INTO tb_notification SET ?", data, (error, results) => {
                            if (error) { return callback(config.SQL_ERROR); }
                            // 获取自增主键
                            data.notificationId = results.insertId;
                            // 发送到群里
                            socket.to(groupId).emit("on_notification", data);
                            // 回调
                            callback(u.rsp(config.SUCCESS_CODE, data));
                        });
                    });
            } else {
                return callback(config.ARG_ERROR);
            }
        });


        /**
         * 发送访问资源
         */
        socket.on('send_access_res', (data, callback) => {
            // 判空与取出数据
            if (!data) { return callback(config.ERROR); }
            data = handleData(data, callback);
            if (data === false) return;
            // 检查参数：resourceId、username和state
            let resourceId = data[this.opts.RESOURCE_KEY];
            let username = data[this.opts.USER_KEY];
            let state = data[this.opts.STATE_KEY];
            if (u.isEmpty(resourceId) || u.isEmpty(username) || (state !== 0 && state !==1 ))
                return callback(config.ARG_ERROR);
            let params = {resourceId: resourceId, accessTime: new Date().getTime(), userId: data[this.opts.USER_ID_KEY],
                      username: username, state: state};
            // 插入数据库
            mysql.query("INSERT INTO tb_access_record SET ?", params, (error) => {
                if (error) { return callback(config.SQL_ERROR); }
                // 回调
                callback(config.SUCCESS);
            });
        });


        /**
         * 查询通知（弃用）
         */
/*        socket.on('query_notification', (data, callback) => {
            // 判空与取出数据
            if (!data) { return callback(config.ERROR); }
            data = handleData(data, callback);
            if (data === false) return;
            // 取出用户名
            let username = data[this.opts.SENDER_KEY];
            if (u.isEmpty(username)) { return callback(config.ARG_ERROR); }
        });*/


        /**
         * 查询聊天记录（弃用）
         */
/*        socket.on('query_chat_msg', (data, callback) => {
            logger.debug("query_chat_msg");
            logger.debug(data);
            // 判空与取出数据
            if (!data) { return callback(config.ERROR); }
            data = handleData(data, callback);
            if (data === false) return callback(config.ARG_ERROR);
            // 取出msgId和用户名
            let msgId = data.msgId;
            let username = data[this.opts.SENDER_KEY];
            if (u.isEmpty(msgId) || u.isEmpty(username)) { return callback(config.ARG_ERROR); }

            let sql_pre = "SELECT * from tb_message" +
                          " WHERE (receiverName=?" +
                          " OR FIND_IN_SET(groupId, (SELECT GROUP_CONCAT(groupId) FROM tb_prelession_group_user_relation WHERE username=? GROUP BY username)))";
            let sql, params;

            // 判断，如果msgId === 0，则从tb_ack中获取最后的msgId
            if (msgId === 0) {
                sql = sql_pre + " AND msgId>(IFNULL((SELECT ack_msgId FROM tb_ack WHERE ack_username=?), 0))";
                params = [username, username, username];
            } else {
                sql = sql_pre + " AND msgId>?";
                params = [username, username, msgId];
            }

            mysql.query(sql, params, (error, results) => {
                if (error) { return callback(config.SQL_ERROR); }
                if (results.length === 0) { return callback(u.rsp(config.SUCCESS_CODE, results)); }
                // 如果有新的历史聊天记录，更新最后的聊天ack
                let sql = "INSERT INTO tb_ack(ack_username,ack_msgId) VALUES(?, ?)" +
                    " ON DUPLICATE KEY UPDATE ack_msgId=VALUES(ack_msgId)";
                mysql.query(sql, [username, results[results.length-1].msgId], (error) => {
                    if (error) { return callback(u.rsp(config.FAIL_CODE, "查询失败")); }
                    return callback(u.rsp(config.SUCCESS_CODE, results));
                });
            });
        });*/

        /**
         * 更新通知ack（确认客户端收到了通知，更新最后收到的通知）
         */
        socket.on('ack_chat_notification', (data, callback) => {
            logger.debug(data);
            // 判空，取出数据
            if (data) {
                data = handleData(data);
                if (data !== false) {
                    // 取出username和notificationId
                    let username = data[this.opts.RECEIVER_KEY];
                    let notificationId = data[this.opts.NOTICE_KEY];
                    if (!u.isEmpty(username) && !u.isEmpty(notificationId)) {
                        let sql = "INSERT INTO tb_ack(ack_username,ack_notificationId) VALUES(?, ?)" +
                                  " ON DUPLICATE KEY UPDATE ack_notificationId=VALUES(ack_notificationId)";
                        mysql.query(sql, [username, notificationId], () => {});
                    }
                }
            }
            callback();
        });

        /**
         * 更新聊天消息ack（更新用户最后收到的聊天消息）
         */
        socket.on('ack_chat_message', (data, callback) => {
            logger.debug(data);
            // 判空，取出数据
            if (data) {
                data = handleData(data);
                if (data !== false) {
                    // 取出username和msgId
                    let username = data[this.opts.RECEIVER_KEY];
                    let msgId = data[this.opts.NOTICE_KEY];
                    if (!u.isEmpty(username) && !u.isEmpty(msgId)) {
                        let sql = "INSERT INTO tb_ack(ack_username,ack_msgId) VALUES(?, ?)" +
                                  " ON DUPLICATE KEY UPDATE ack_msgId=VALUES(ack_msgId)";
                        mysql.query(sql, [username, notificationId], () => {});
                    }
                }
            }
            callback();
        });


    });
};

/**
 * 数据处理：将字符串转换为JSON
 * @param data      处理前数据
 * @param callback  如果发生错误，则从此进行回调
 * @return  处理成功返回处理后的JSON数据，失败则返回false
 */
function handleData(data, callback) {
    try {
        return JSON.parse(data);
    } catch (e) {
        if (callback) callback({code: config.FAIL_CODE, msg: "数据格式错误!"});
        logger.error("数据转换JSON错误!");
        logger.error(e);
        return false;
    }
}

/**
 * 将userNameGroup内的用户加入或退出指定groupId的群组
 * @param groupId       群组id
 * @param userNameGroup 用户名组，中间以逗号','分隔
 * @param isJoin        加退标识，true时表示加入，反之反之
 */
SocketServer.prototype.joinLeaveRoom = function(groupId, userNameGroup, isJoin) {
    if (groupId === undefined || userNameGroup === "") return;
    let userNameArray = userNameGroup.split(",");
    _.each(userNameArray, (username) => {
        // 根据userId找出该用户下的所有socket
        let socketArray = this.users.get(username);
        if (socketArray) {
            _.each(socketArray, (socket) => {
                // 根据socketId找出socket
                let _socket = _.findWhere(this.io.sockets.sockets, {id: socket.id});
                // 如果该socket还存活，则将其加入或离开群组
                if (_socket) {
                    if (isJoin) {
                        _socket.join(groupId);
                    } else {
                        _socket.leave(groupId);
                    }
                }
            });
        }
    });
};

/**
 * 将新的socket放入用户的socket数组内
 * @param username    用户名
 * @param socket    socket类(@class Socket)
 */
SocketServer.prototype.pushSocket = function(username, socket) {
    let user = this.users.get(username);
    // 循环遍历检查该用户已经存在的socket，将之前的客户端(type=0)强制下线
    // 注：这里使用了逆向循环，防止删除过程中导致元素错位
    for (let idx = user.length - 1; idx >= 0; idx--) {
        let ele = user[idx];
        let socketId = ele.id;
        // 根据socketId找出socket
        let _socket = _.findWhere(this.io.sockets.sockets, {id: socketId});
        // 如果socket类型为0(新的socket和旧的socket)且socket还存在，则要将其下线
        if (socket.type === 0 && ele.type === 0 && _socket) {
            // 将socket强制下线
            _socket.disconnect(true);
            logger.info(username + "[" + socketId + "]被强制下线。");
            // 从数组去除该socket
            user.splice(idx, 1);
        }
        // 如果socket不存在了，说明已经离线，要将冗余数据删除
        // 注：客户端离线的时候服务器不会主动将该socket数据删除，
        //     而是等下一次该用户的客户端接入的时候再删除，以提高效率
        if (!_socket) {
            user.splice(idx, 1);
        }
    }

    // 将新的socket放入该用户的socket数组中
    user.push(socket);
};

/**
 * 获取当前连接的用户信息
 * @return info: {
 *              size: 当前用户的个数，并不是设备的个数
 *              users: 用户信息，格式：[{username:xxx,sockets:{["id":"xx","type":x}],[{...}]}]
 *        }
 */
SocketServer.prototype.getUserInfo = function(username) {

    let size = 0;
    let users = [];

    // 如果username不为空，则说明是根据username来搜索用户信息
    if (username) {
        let val = this.users.get(username);
        if (val) { handleSockets.call(this, val, username); }
    } else {
        // 遍历map
        for (let [key, val] of this.users.entries()) {
            handleSockets.call(this, val, key);
        }
    }

    // socket处理函数
    function handleSockets(val, key) {
        let isAlive = false;
        let sockets = [];
        for (let i = 0; i < val.length; i++) {
            // 如果socket还存活，则将其放入结果内
            if (_.findWhere(this.io.sockets.sockets, {id: val[i].id})) {
                isAlive = true;
                sockets.push(val[i]);
            }
        }

        // 如果socket还存在，则将其放入结果内
        if (isAlive) {
            size++;
            users.push({username: key, sockets: sockets});
        }
    }

    return {
        size: size,
        users: users
    };
};

/**
 * Socket类
 * @class       Socket
 * @param id    socket.id
 * @param type  socket的类型(默认值为0)[0:手机客户端; 1:网页端]
 * @constructor 构造函数
 */
class Socket {
    constructor(id, type) {
        this.id = id;
        this.type = type || config.socket_io.DEFAULT_SOCKET_TYPE;
    }
}





