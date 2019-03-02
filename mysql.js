const config = require('./config/config');
const mysql = require('mysql');
const logger = require('./log').getLogger(config.log_categories);
const strict = config.log_strict;

/**
 * Module exports.
 * @module mysql数据库交互模块
 */
module.exports = MySQL;

function MySQL(opts) {
    if (!(this instanceof MySQL)) return new MySQL(opts);
    /**
     * 连接池配置
     */
    this.pool = mysql.createPool({
        host     : opts.HOST,
        user     : opts.USER,
        password : opts.PASSWORD,
        database : opts.DATA_BASE,
        connectionLimit: opts.CONNECTION_LIMIT,
        timezone: opts.TIMEZONE,
    });
}

/**
 * 获取连接
 * 注意：获取连接并且操作完毕后，记得调用release()方法释放连接
 */
MySQL.prototype.getConnection = function(callback) {
    this.pool.getConnection(callback);
};

/**
 * 数据库操作（自动获取、释放连接，适合单次sql操作）
 * @param sql       sql语句
 * @param values    参数值
 * @param callback  回调
 */
MySQL.prototype.query = function(sql, values, callback) {
    // SQL判空
    if (!sql) {
        logger.error("用法错误，传入的SQL为空！");
        throw 0;
    }

    // 获取连接
    this.pool.getConnection((err, connection) => {
        if (err) {
            // 无法获取连接
            // 打印日志
            logger.error("无法获取MySQL连接！");
            if (strict) { logger.error(err); }
            return callback(err);
        }
        // 使用连接
        connection.query(sql, values, (error, results, fields) => {
            // 当完成所有操作之后，释放连接。
            connection.release();

            // 打印日志
            if (error) {
                logger.error("SQL执行错误！");
                if (strict) { logger.error(error); }
            } else {
                if (strict) {
                    logger.info("SQL执行成功！");
                    logger.info("SQL：" + sql);
                    logger.info("参数：" + values);
                    logger.info(results);
                }
            }

            // 返回结果
            callback(error, results, fields);
        });
    });
};

/**
 * 事务操作（多条DML）
 * @param sql_array     多条DML的SQL，以字符串数组形式传递
 * @param values_array  多个values组，以数组形式传递（注意，没有参数也必须传递[]）
 * @param callback  回调
 */
MySQL.prototype.transaction = function(sql_array, values_array, callback) {
    // 判空，判长
    if (!sql_array || !values_array) {
        logger.error("用法错误，传入的SQL或参数为空！");
        throw 0;
    }
    if (sql_array.length !== values_array.length) {
        logger.error("用法错误，sql组和参数组的长度不一致！");
        throw 0;
    }

    // 获取连接
    this.pool.getConnection((err, connection) => {
        // 无法获取连接
        if (err) {
            logger.error("无法获取MySQL连接！");
            if (strict) { logger.error(err); }
            return callback(err);
        }

        // 开始事务操作
        connection.beginTransaction((err) => {
            // 事务开启失败
            if (err) {
                logger.error("无法开启事务！");
                if (strict) { logger.error(err); }
                return callback(err);
            }
            // 存储所有结果的数组
            let results_array = [];
            // 开始递归运行DML语句
            queryWithConnection(sql_array, values_array, results_array, connection, 0, sql_array.length, (error) => {
                // 释放连接
                connection.release();
                callback(error, results_array);
            });
        });
    });
};

/**
 * 指定connection进行数据库操作（用于递归）
 * @param sql_array
 * @param values_array
 * @param results_array
 * @param connection
 * @param index
 * @param length
 * @param callback
 */
const queryWithConnection = (sql_array, values_array, results_array, connection, index, length, callback) => {
    connection.query(sql_array[index], values_array[index], (error, results, fields) => {
        // DML操作失败
        if (error) {
            return connection.rollback(() => {
                logger.error("SQL执行错误，进行事务回滚。");
                if (strict) { logger.error(error); }
                callback(error);
            });
        }
        if (strict) {
            logger.info("SQL执行成功！");
            logger.info("SQL：" + sql_array[index]);
            logger.info("参数：" + values_array[index]);
            logger.info(results);
        }
        // 将结果放入结果数组
        results_array.push(results);
        // 如果还有则继续递归
        if (++index < length) {
            queryWithConnection(sql_array, values_array, results_array, connection, index, length, callback);
        } else {
            logger.info("提交事务");
            // 否则提交事务
            connection.commit((err) => {
                if (err) {
                    return connection.rollback(() => {
                        logger.error("事务提交失败，进行事务回滚。");
                        if (strict) { logger.error(err); }
                        callback(err);
                    });
                }
                callback();
            });
        }
    });
};



