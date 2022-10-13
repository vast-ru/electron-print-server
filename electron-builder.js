module.exports = () => {
    const buildStr = process.env.BUILD_NUMBER ? '.${env.BUILD_NUMBER}' : '';
    return {
        productName : "Electron print server",
        nsis        : {
            oneClick    : false,
            artifactName: '${productName}-${version}' + buildStr + '-${os}-${arch}-Installer.${ext}',
        },
        artifactName: '${productName}-${version}' + buildStr + '-${os}-${arch}.${ext}',
        extraResources: './external/fonts',
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
