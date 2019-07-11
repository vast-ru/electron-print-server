module.exports = () => {
    const artifactName = process.env.BUILD_NUMBER
        ? '${productName}-${version}.${env.BUILD_NUMBER}-${os}-${arch}.${ext}'
        : '${productName}-${version}-${platform}-${os}.${ext}';
    return {
        productName : "Electron print server",
        nsis        : {
            oneClick: false,
        },
        artifactName: artifactName,
        win         : {
            target        : [
                {
                    target: "portable",
                    arch  : ['ia32', 'x64'],
                },
                {
                    target: "nsis",
                    arch  : ['ia32', 'x64'],
                },
            ],
            extraResources: "./external/win32/${arch}",
        },
        linux       : {
            target  : [
                "tar.gz",
                "deb"
            ],
            category: "Printing",
        },
    };
};
