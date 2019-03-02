$(function() {
    // 避免iframe页面嵌套
    if (window !== top) {
        top.location.href = location.href;
    }
});
