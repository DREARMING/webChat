const config = {
    language: "zh",
    server_name: "webChat",
    log_categories: "console",  //详细参考log.js注释
    log_strict: true,           //是否开启日志严格模式，开启后会打印更详细的日志信息
    isWww: false,                //是否开启www服务器，如果不需要后台查看用户信息，可以关闭此项
    /* 返回的code值和result值开始 */
    FAIL_CODE: -1,
    SUCCESS_CODE: 200,
    SUCCESS: {code: 200},
    ERROR: {code: -1},
    SQL_ERROR: {code: -2},
    JOIN_ERROR: {code: -3},
    ARG_ERROR: {code: -4},
    ALREADY_EXISTS_ERROR: {code: -5},
    NOT_EXISTS_ERROR: {code: -6, msg: '该用户不在群组内'},
    /* 返回的code值和result值结束 */
    socket_io: {
        LISTEN_PORT: 3030,      //socket.io监听端口
        DEFAULT_SOCKET_TYPE: 0, //默认socket类型
        USER_INFO_KEY: "userInfo",  //用户信息登记的键
        USER_KEY: "username",   //用户名的键
        USER_ID_KEY: "userId",  //用户id的键
        LOGIN_TIME_KEY: "loginTime",//用户登录时间的键
        MSG_TYPE_KEY: "msgType",    //消息类型的键
        msgType: {  //消息类型
            TEXT: 0,    //文本
            VOICE: 2,   //语音
            JOIN_LEAVE: 5,    //进退群
            CHANGE: 6,  //群成员变更
        },
        SEND_TYPE_KEY: "sendType",  //消息发送类型
        sendType: { //消息发送类型
            SINGLE: 0,  //单发(私聊)
            MASS: 1,    //群发
        },
        GROUP_KEY: "groupId",           //群组id的键
        CONTENT_KEY: "content",         //内容的键
        SENDER_KEY: "senderName",       //发送者username的键
        RECEIVER_KEY: "receiverName",   //接收者username的键
        ENTER_STATE_KEY: "enterState",  //进退群标识的键
        enterState: {   //进退群标识
            JOIN: 1,    //进群
            LEAVE: 2,   //退群
        },
        RESOURCE_KEY: "resourceId",     //资源id的键
        STATE_KEY: "state",             //状态键
        NOTICE_KEY: "notificationId",   //通知id的键
    },
    mysql: {        //mysql连接相关配置
        HOST: "localhost",
        USER: "root",
        PASSWORD: "08130125cjj",
        DATA_BASE: "webChat",
        CONNECTION_LIMIT: 20,   //连接池最大数量
        TIMEZONE: "08:00",      //时区（默认东八）
    },
    api_server: {   //API服务相关
        LISTEN_PORT: 6080,      // 监听端口
        url: {
            PREFIX: "/",
            CHAT_ROOM: {
                CREATE: "chatroom/create",
                DELETE: "chatroom/delete",
                UPDATE: "chatroom/update",
                QUERY_VISITOR_LIST: "chatroom/queryVisitorList",
                QUERY_NOTIFICATION: "chatroom/queryNotification",
                QUERY_CHAT_MSG: "chatroom/queryChatMessageList",
            },
            SERVER: {
                USER_INFO: "server/userInfo",
            },
        },
    },
    www: {  //www服务器相关（图形化后台管理）
        LISTEN_PORT: 3000,      // 监听端口
        session: {
            NAME: "wcKey",
            SECRET: "creator",  // 用来对session id相关的cookie进行签名
            SAVE_UNINITIALIZED: true,  // 是否自动保存未初始化的会话
            RE_SAVE: false,  // 是否每次都重新保存会话
            MAX_AGE: 3 * 60 * 1000,  // cookie有效时间，单位毫秒
            LOGIN_USER_KEY: "loginUser",    // 用户登录之后保存在session的key值
            REDIS_CONFIG: {
                host: "127.0.0.1",  // IP
                port: "6379",       // 端口号
                db: 0,              // 使用哪一个数据库
                ttl: 3 * 60,        // session会话保存时间，单位秒，注意与上面的MAX_AGE最好保持一致
                logErrors: true
            }
        },
        users: [    // 账号配置
            {username: "admin", password: "admin"},     // 如果需要添加后台管理的账号，直接在这里添加即可
        ]
    },
};

module.exports = config;