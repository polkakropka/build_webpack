const webpack = require("webpack");
const {
    resolve
} = require("path");
const globby = require("globby");
const {
    getIfUtils,
    removeEmpty
} = require("webpack-config-utils");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const EventHooksPlugin = require("event-hooks-webpack-plugin");
const plConfig = require("./patternlab-config.json");
const patternlab = require("patternlab-node")(plConfig);
const patternEngines = require("patternlab-node/core/lib/pattern_engines");
const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
require('./postcss.config');

module.exports = (env) => {
    const {
        ifProduction,
        ifDevelopment
    } = getIfUtils(env);
    const config = {
        devtool: ifDevelopment("source-map"),
        node: {
            fs: "empty"
        },
        entry: {
            "script": globby.sync([
                resolve(__dirname, `${plConfig.paths.source.js}**/*.js`), "!**/*.test.js", "!polyfills/*.js", "!e-commerce/*.js"
            ]).map(function (filePath) {
                return filePath;
            }),
            "polyfill": globby.sync([
                resolve(__dirname, `${plConfig.paths.source.js}polyfills/*.js`), "!**/*.test.js"
            ]).map(function (filePath) {
                return filePath;
            })
        },
        output: {
            path: resolve(__dirname, plConfig.paths.public.root),
            filename: "assets/js/[name].bundle.js"
        },
        plugins: removeEmpty([
            ifDevelopment(
                new webpack.HotModuleReplacementPlugin(),
                new webpack.NamedModulesPlugin()
            ),
            // Remove with PL Core 3.x
            new CopyWebpackPlugin([{
                    // Copy all images from source to public
                    context: resolve(plConfig.paths.source.images),
                    from: "./**/*.*",
                    to: resolve(plConfig.paths.public.images)
                },
                {
                    // Copy all json from source to public
                    context: resolve(plConfig.paths.source.json),
                    from: "./**/*.*",
                    to: resolve(plConfig.paths.public.json)
                },
                {
                    // Copy favicon from source to public
                    context: resolve(plConfig.paths.source.root),
                    from: "./*.ico",
                    to: resolve(plConfig.paths.public.root)
                },
                {
                    // Copy all web fonts from source to public
                    context: resolve(plConfig.paths.source.fonts),
                    from: "./*",
                    to: resolve(plConfig.paths.public.fonts)
                },
                {
                    // Copy all css from source to public
                    context: resolve(plConfig.paths.source.css),
                    from: "./*.css",
                    to: resolve(plConfig.paths.public.css)
                },
                {
                    // Styleguide Copy everything but css
                    context: resolve(plConfig.paths.source.styleguide),
                    from: "./**/*",
                    to: resolve(plConfig.paths.public.root),
                    ignore: ["*.css"]
                },
                {
                    // Styleguide Copy and flatten css
                    context: resolve(plConfig.paths.source.styleguide),
                    from: "./**/*.css",
                    to: resolve(plConfig.paths.public.styleguide, "css"),
                    flatten: true
                }
            ]),
            ifDevelopment(
                new EventHooksPlugin({
                    afterEmit: function (compilation) {
                        const supportedTemplateExtensions = patternEngines.getSupportedFileExtensions();
                        const templateFilePaths = supportedTemplateExtensions.map(
                            function (dotExtension) {
                                return `${plConfig.paths.source.patterns}**/*${dotExtension}`;
                            }
                        );

                        // additional watch files
                        const watchFiles = [
                            `${plConfig.paths.source.patterns}**/*.(json|md|yaml|yml)`,
                            `${plConfig.paths.source.data}**/*.(json|md|yaml|yml)`,
                            `${plConfig.paths.source.fonts}**/*`,
                            `${plConfig.paths.source.images}**/*`,
                            `${plConfig.paths.source.meta}**/*`,
                            `${plConfig.paths.source.annotations}**/*`
                        ];

                        const allWatchFiles = watchFiles.concat(templateFilePaths);

                        allWatchFiles.forEach(function (globPath) {
                            const patternFiles = globby
                                .sync(globPath)
                                .map(function (filePath) {
                                    return resolve(__dirname, filePath);
                                });
                            patternFiles.forEach(item => {
                                compilation.fileDependencies.add(item);
                            });
                        });
                    }
                })
            ),
            new EventHooksPlugin({
                done: function (stats) {
                    let cleanPublic = plConfig.cleanPublic;
                    process.argv.forEach((val, index) => {
                        if (val.includes("cleanPublic")) {
                            val = val.split("=");
                            cleanPublic = JSON.parse(val[1]);
                        }
                    });

                    patternlab.build(() => {}, cleanPublic);
                }
            }),
            new BrowserSyncPlugin({
                host: 'localhost',
                port: 9000,
                proxy: 'http://localhost:5000/',
                open: false
            }, {
                reload: false
            }),
            new MiniCssExtractPlugin({
                filename: 'assets/css/styles.bundle.css'
            })
        ]),
        devServer: {
            contentBase: resolve(__dirname, plConfig.paths.public.root),
            port: plConfig.app.webpackDevServer.port,
            compress: true,
            open: false,
            overlay: true,
            hot: true
        },
        module: {
            rules: [{
                    test: /\.js$/,
                    exclude: /(node_modules|bower_components)/,
                    use: {
                        loader: "babel-loader",
                        options: {
                            presets: [
                                [
                                    "env",
                                    {
                                        targets: {
                                            browsers: [
                                              "Chrome >= 52",
                                              "FireFox >= 44",
                                              "Safari >= 7",
                                              "Explorer 11",
                                              "last 4 Edge versions"
                                            ]
                                        }
                                    }
                                ]
                            ]
                        }
                    }
                },
                {
                    test: /\.scss$/,
                    use: [
                        'style-loader',
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        'postcss-loader',
                        'sass-loader'
                    ]
                },
                {
                    test: /\.(svg|ttf|eot|woff|woff2)$/,
                    use: {
                        loader: "file-loader",
                        options: {
                            name: "assets/fonts/[name].[ext]",
                            publicPath: ifProduction ? '../../' : '/',
                        }
                    }
                },
                {
                    test: /\.(gif|jpe?g|png|svg)$/,
                    loader: 'url-loader?limit=25000'
                },
                {
                    test: /\.font\.js/,
                    loader: [
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        'webfonts-loader'
                    ]
                }
            ]
        },
        resolve: {
            extensions: ['.js', '.tsx', '.ts', '.css', '.scss']
        },
        optimization: {
            minimizer: [new UglifyJsPlugin(plConfig.app.uglify)],
            minimize: !!ifProduction,
        }
    };
    return config;
};

// TODO: Add iconFont task
// TODO: get project name from config and add it to bundle file names
