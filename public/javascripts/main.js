$(function() {
    $("#update").click(function() {
        let url = "/userInfo";
        let $search_input = $("#search_input");
        if ($search_input.val()) {
            url = url + "?un=" + $search_input.val();
        }
        $("iframe").attr("src", url);
    });

    $("#search_input").on("input", function() {
        if ($(this).val()) {
            $("#update").text("搜索");
        } else {
            $("#update").text("刷新");
        }
    });
});
