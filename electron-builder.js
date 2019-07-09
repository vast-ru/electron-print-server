module.exports = () => {
    return {
        productName: "Electron print server",
        nsis       : {
            oneClick: false
        },
        win        : {
            target        : [
                "portable",
                "nsis"
            ],
            extraResources: "./external/win32/${arch}"
        },
        linux      : {
            target  : [
                "tar.gz",
                "deb"
            ],
            category: "Printing"
        }
    };
};
