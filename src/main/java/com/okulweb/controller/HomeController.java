package com.okulweb.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "index";
    }

    @GetMapping("/hakkimizda")
    public String about() {
        return "hakkimizda";
    }

    @GetMapping("/iletisim")
    public String contact() {
        return "iletisim";
    }
}
