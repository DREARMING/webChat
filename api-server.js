const app = require('express')();
const config = require('./config/config');
const logger = require('./log').getLogger(config.log_categories);
const _ = require('underscore');
const u = require('./utils')();
const mysql = require('./mysql')(config.mysql);
const bodyParser = require('body-parser');
// 创建 application/x-www-form-urlencoded 编码解析
const urlencodedParser = bodyParser.urlencoded({ extended: false });

/**
 * Module exports.
 * @module Api服务器模块
 */
module.exports = ApiServer;

function ApiServer(opts, socketServer) {
    if (!(this instanceof ApiServer)) return new ApiServer(opts, socketServer);
    this.opts = opts;
    this.app = app;
    this.socketServer = socketServer;
    this.initServer();
}

ApiServer.prototype.start = function() {
    const server = app.listen(this.opts.LISTEN_PORT, function () {
        let host = server.address().address;
        let port = server.address().port;
        logger.info("ApiServer服务器开启成功[http://%s:%s]。", host, port);
    });
};

ApiServer.prototype.initServer = function() {
    const socketServer = this.socketServer;
    const url = this.opts.url;
    /**
     * 创建群组
     */
    this.app.post(url.PREFIX + url.CHAT_ROOM.CREATE, urlencodedParser, function (req, res) {
        // 取出body
        let body = req.body;
        // 取出userId、groupType、groupJson和groupId
        let userId = body.userId;
        let groupType = body.groupType;
        let groupJson;
        // 设置response编码
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
        try {
            groupJson = JSON.parse(body.groupJson);
        } catch (e) {
            logger.error("创建群组groupJson转换错误:" + e);
            return res.end(u.rspStr(config.ARG_ERROR, "JSON格式错误:" + e));
        }
        let groupId = body.groupId;
        if (u.isEmpty(userId) || u.isEmpty(groupType) || u.isEmpty(groupJson) || u.isEmpty(groupId)) {
            return res.end(u.rspStr(config.FAIL_CODE, "参数错误"));
        }
        // 判断groupType(暂时只有备课组[3])
        if (groupType !== "3") {
            return res.end(u.rspStr(config.FAIL_CODE, "目前只有备课组，groupType不正确"));
        }
        // 生成创建群组和插入群成员的SQL语句和values值
        let sqlArray = [];
        let valuesArray = [];

        sqlArray.push("INSERT INTO tb_prelession_group SET ?");
        valuesArray.push({groupId: groupId, groupName: groupJson.groupName,
                          memberNums: groupJson.memberNums, creatorId: groupJson.creatorId});
        let memberList = groupJson.memberList;
        let userNameGroup = "";   //需要加入群组的用户名组(socket->room)
        // 判断是否有群成员需要插入
        let isInsert = memberList !== undefined && memberList.length > 0;
        if (isInsert) {
            let groupUserSql = "INSERT INTO tb_prelession_group_user_relation(groupId,userId,username,nickname) VALUES";
            _.each(memberList, (ele) => {
                groupUserSql += "(" + groupId + "," + ele.userId + ",'" + ele.username + "','" + ele.nickname + "'),";
                userNameGroup = userNameGroup + ele.username + ",";
            });
            sqlArray.push(groupUserSql.substring(0, groupUserSql.length - 1));
            valuesArray.push([]);
        }

        // 事务操作
        mysql.transaction(sqlArray, valuesArray, (error) => {
            if (error) {
                let msg = "创建失败";
                if (error.code === 'ER_DUP_ENTRY') {
                    msg += "，该群组已经存在或组员已经存在该群组内"
                }
                return res.end(u.rspStr(config.FAIL_CODE, msg));
            }
            // 将新增的用户加入socket的群组内
            if (isInsert) {
                socketServer.joinLeaveRoom(groupId, userNameGroup.substring(0, userNameGroup.length - 1), true);
            }
            return res.end(u.rspStr(config.SUCCESS_CODE, "创建成功"));
        });
    });

    /**
     * 删除群组
     */
    this.app.post(url.PREFIX + url.CHAT_ROOM.DELETE, urlencodedParser, function (req, res) {
        // 取出body
        let body = req.body;
        // 取出userId、groupType和groupId
        let userId = body.userId;
        let groupType = body.groupType;
        let groupId = body.groupId;
        // 设置response编码
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
        if (u.isEmpty(userId) || u.isEmpty(groupType) || u.isEmpty(groupId)) {
            return res.end(u.rspStr(config.FAIL_CODE, "参数错误"));
        }
        // 判断groupType(暂时只有备课组[3])
        if (groupType !== "3") {
            return res.end(u.rspStr(config.FAIL_CODE, "目前只有备课组，groupType不正确"));
        }

        // 删除群组以及群组下面的所有群员信息
        let sqlArray = [];
        let valuesArray = [];

        sqlArray.push("DELETE FROM tb_prelession_group_user_relation WHERE groupId=?");
        valuesArray.push([groupId]);
        sqlArray.push("DELETE FROM tb_prelession_group WHERE groupId=?");
        valuesArray.push([groupId]);

        // 事务操作
        mysql.transaction(sqlArray, valuesArray, (error) => {
            if (error) { return res.end(u.rspStr(config.FAIL_CODE, "删除失败")); }
            // 删除群组之后无需将用户从socket群组(room)中退出，因为用户断开连接的时候会自动退出
            return res.end(u.rspStr(config.SUCCESS_CODE, "删除成功"));
        });
    });

    /**
     * 更新群组
     */
    this.app.post(url.PREFIX + url.CHAT_ROOM.UPDATE, urlencodedParser, function (req, res) {
        // 取出body
        let body = req.body;
        // 取出userId、groupType和groupJson
        let userId = body.userId;
        let groupType = body.groupType;
        let groupJson = JSON.parse(body.groupJson);
        // 设置response编码
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
        if (u.isEmpty(userId) || u.isEmpty(groupType) || u.isEmpty(groupJson)) {
            return res.end(u.rspStr(config.FAIL_CODE, "参数错误"));
        }
        // 判断groupType(暂时只有备课组[3])
        if (groupType !== "3") {
            return res.end(u.rspStr(config.FAIL_CODE, "目前只有备课组，groupType不正确"));
        }

        // 所有操作之前必须检查群组是否存在
        mysql.query("SELECT COUNT(1) AS num FROM tb_prelession_group WHERE groupId=?", groupJson.groupId, (error, results) => {
            if (error) { return res.end(u.rspStr(config.FAIL_CODE, "更新失败")); }
            if (results[0].num <= 0) {
                return res.end(u.rspStr(config.FAIL_CODE, "群组不存在"));
            }

            // 生成更新群组和更新群成员的SQL语句和values值
            let sqlArray = [];
            let valuesArray = [];
            // 更新群组信息
            sqlArray.push("UPDATE tb_prelession_group SET groupName=?,memberNums=?,creatorId=? WHERE groupId=?");
            valuesArray.push([groupJson.groupName, groupJson.memberNums, groupJson.creatorId, groupJson.groupId]);

            // 更新群员信息
            let memberList = groupJson.memberList;
            mysql.query("SELECT * FROM tb_prelession_group_user_relation WHERE groupId=?", groupJson.groupId, (error, results) => {
                if (error) { res.end(u.rspStr(config.FAIL_CODE, "SQL错误")); }

                // 将查询的结果(旧的群员)放入map，提高查询效率(一般旧的群员会比较多，所以将旧成员放入Map内，将查询复杂度降低至O(1))
                let userMap = new Map();
                _.each(results, (ele) => {
                    userMap.set(ele.username, ele);
                });

                let userNameGroup = "";   //需要加入群组的用户名组(socket->room)
                // 如果memberList不为空，说明需要进行新增修改操作
                let isInsertUpdate = memberList !== undefined && memberList.length > 0;
                if (isInsertUpdate) {
                    let sql = "INSERT INTO tb_prelession_group_user_relation(groupId,userId,username,nickname) VALUES";
                    // 遍历新的组成员
                    _.each(memberList, (ele) => {
                        sql += "(" + groupJson.groupId + "," + ele.userId + ",'" + ele.username + "','" + ele.nickname + "'),";
                        // 从旧成员map中删除与新成员列表中相同username的数据
                        if (userMap.get(ele.username)) {
                            userMap.delete(ele.username);
                        } else {
                            // 这里的是需要新增的用户
                            userNameGroup = userNameGroup + ele.username + ",";
                        }
                    });
                    // 拼接sql
                    sql = sql.substring(0, sql.length - 1);
                    sql += "ON DUPLICATE KEY UPDATE username=VALUES(username),nickname=VALUES(nickname)";
                    sqlArray.push(sql);
                    valuesArray.push([]);
                }

                // 需要删除的用户
                let deleteGroup = "";
                // map剩下的就是要删除的，拼接成字符串组
                for (let key of userMap.keys()) {
                    deleteGroup = deleteGroup + key + ",";
                }
                // 如果需要删除组员，则添加删除sql语句
                if (deleteGroup !== "") {
                    sqlArray.push("DELETE FROM tb_prelession_group_user_relation WHERE FIND_IN_SET(username,?) AND groupId=?");
                    valuesArray.push([deleteGroup.substring(0, deleteGroup.length - 1), groupJson.groupId]);
                }

                mysql.transaction(sqlArray, valuesArray, (error) => {
                    if (error) { return res.end(u.rspStr(config.FAIL_CODE, "更新失败")); }
                    // 将新增的用户加入socket的群组内
                    if (isInsertUpdate) {
                        socketServer.joinLeaveRoom(groupJson.groupId, userNameGroup.substring(0, userNameGroup.length - 1), true);
                    }
                    // 将删除的用户从socket的群组中退出
                    if (deleteGroup !== "") {
                        socketServer.joinLeaveRoom(groupJson.groupId, deleteGroup, false);
                    }
                    return res.end(u.rspStr(config.SUCCESS_CODE, "更新成功"));
                });
            });
        });
    });

    /**
     * 根据资源id
     */

    /**
     * 查询通知
     */
    this.app.get(url.PREFIX + url.CHAT_ROOM.QUERY_NOTIFICATION, function (req, res) {
        logger.debug("queryNotification");
        // logger.debug(req.query);
        let params = req.query;
        // 取出username和notificationId
        let username = params.username;
        let notificationJson = params.notificationJson;
        let notificationId;
        try {
            notificationId = JSON.parse(notificationJson).msgId;
        } catch (e) {
            return res.end(u.rspStr(config.FAIL_CODE, "notificationJson格式错误"));
        }

        // 设置response编码
        res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
        if (u.isEmpty(username) || u.isEmpty(notificationId)) {
            return res.end(u.rspStr(config.FAIL_CODE, "参数错误"));
        }

        let sql_pre = "SELECT * FROM tb_notification" +
                      " WHERE (receiverName=?" +
                      " OR FIND_IN_SET(groupId, (SELECT GROUP_CONCAT(groupId) FROM tb_prelession_group_user_relation WHERE username=? GROUP BY username)))";
        let sql, _params;
        // 判断，如果notificationId === 0，则从tb_ack中获取最后的notificationId
        if (notificationId === 0) {
            sql = sql_pre + " AND notificationId>(IFNULL((SELECT ack_notificationId FROM tb_ack WHERE ack_username=?), 0))";
            _params = [username, username, username];
        } else {
            sql = sql_pre + " AND notificationId>?";
            _params = [username, username, notificationId];
        }

        mysql.query(sql, _params, (error, results) => {
            if (error) { return res.end(u.rspStr(config.FAIL_CODE, "查询失败")); }
            if (results.length === 0) { return res.end(u.rspStr(config.FAIL_CODE, "没有最新通知")); }
            // 更新最后的通知ack
            let sql = "INSERT INTO tb_ack(ack_username,ack_notificationId) VALUES(?, ?)" +
                " ON DUPLICATE KEY UPDATE ack_notificationId=VALUES(ack_notificationId)";
            mysql.query(sql, [username, results[results.length-1].notificationId], (error) => {
                if (error) { return res.end(u.rspStr(config.FAIL_CODE, "查询失败")); }
                return res.end(u.rspData(config.SUCCESS_CODE, results));
            });
        });
    });

    /**
     * 查询聊天记录
     */
    this.app.get(url.PREFIX + url.CHAT_ROOM.QUERY_CHAT_MSG, function(req, res) {
        logger.debug("queryChatMessageList");
        let params = req.query;
        logger.debug(params);
        // 取出username和msgId
        let username = params.username;
        let chatMsgJson = params.chatMsgJson;
        let msgId;
        try {
            msgId = JSON.parse(chatMsgJson).msgId;
        } catch (e) {
            return res.end(u.rspStr(config.FAIL_CODE, "chatMsgJson格式错误"));
        }

        if (u.isEmpty(msgId) || u.isEmpty(username)) {
            return res.end(u.rspStr(config.FAIL_CODE, "参数错误"));
        }

        let sql_pre = "SELECT * from tb_message" +
            " WHERE (receiverName=?" +
            " OR FIND_IN_SET(groupId, (SELECT GROUP_CONCAT(groupId) FROM tb_prelession_group_user_relation WHERE username=? GROUP BY username)))";
        let sql, _params;

        // 判断，如果msgId === 0，则从tb_ack中获取最后的msgId
        if (msgId === 0) {
            sql = sql_pre + " AND msgId>(IFNULL((SELECT ack_msgId FROM tb_ack WHERE ack_username=?), 0))";
            _params = [username, username, username];
        } else {
            sql = sql_pre + " AND msgId>?";
            _params = [username, username, msgId];
        }

        mysql.query(sql, _params, (error, results) => {
            if (error) { return res.end(u.rspStr(config.FAIL_CODE, "查询失败")); }
            if (results.length === 0) { return res.end(u.rspData(config.SUCCESS_CODE, results)); }
            // 如果有新的历史聊天记录，更新最后的聊天ack
            let sql = "INSERT INTO tb_ack(ack_username,ack_msgId) VALUES(?, ?)" +
                " ON DUPLICATE KEY UPDATE ack_msgId=VALUES(ack_msgId)";
            mysql.query(sql, [username, results[results.length-1].msgId], (error) => {
                if (error) { return res.end(u.rspStr(config.FAIL_CODE, "查询失败")); }
                return res.end(u.rspData(config.SUCCESS_CODE, results));
            });
        });
    });


    /**
     * 获取当前socket的用户连接信息
     */
    this.app.get(url.PREFIX + url.SERVER.USER_INFO, function (req, res) {
        let response;

        res.end(JSON.stringify(socketServer.getUserInfo()));
    });

    /**
     * test，ignore
     */
    this.app.get('/test', function (req, res) {
        logger.debug(req.query);
        // 输出 JSON 格式
        let response;
        response = {
            first_name: "san",
            last_name: "zhang"
        };
        res.end(JSON.stringify(response));
    })
};