// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
module.exports = function(grunt) {
  require('matchdep').filterAll('grunt-*').forEach(grunt.loadNpmTasks);
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    babel: {	
      dev: {	
        options: {	
          compact: false,	
          retainLines: true,	
          presets: [ [ '@babel/preset-env', { targets: { ie: '11' } } ] ],	
          sourceType: 'script'	
        },	
        src: 'frontend/build/js/origin.js',	
        dest: 'frontend/build/js/origin.js'	
      },	
      compile: {	
        options: {	
          comments: false,	
          minified: true,	
          presets: [ [ '@babel/preset-env', { targets: { ie: '11' } } ] ],	
          sourceType: 'script'	
        },	
        src: 'frontend/build/js/origin.js',	
        dest: 'frontend/build/js/origin.js'	
      }	
    },
    copy: {
      main: {
        files: [
          {
            expand: true,
            flatten: true,
            src: [
              'app/core/**/assets/**',
              'app/modules/**/assets/**',
              'app/plugins/**/assets/**',
              'app/libraries/**/assets/**'
            ],
            dest: 'build/css/assets/',
            filter: 'isFile'
          },
          {
            expand: true,
            flatten: true,
            src: ['app/libraries/ace/*'],
            dest: 'build/js/ace'
          }
        ]
      }
    },
    'generate-lang-json': {
      options: {
        langFileExt: '.json',
        src: {
          backend: 'routes/lang',
          frontend: 'app/**/lang'
        },
        dest: 'temp/lang'
      }
    },
    handlebars: {
      compile: {
        options: {
          amd: true,
          namespace:"Handlebars.templates",
          processName: function(filePath) {
            var newFilePath = filePath.split("/");
            newFilePath = newFilePath[newFilePath.length - 1].replace(/\.[^/.]+$/, "");
            return  newFilePath;
          },
          partialRegex: /^part_/,
          partialsPathRegex: /\/partials\//
        },
        files: [
          {
            follow: true,
            src: [
              'app/core/**/*.hbs',
              'app/modules/**/*.hbs',
              'app/plugins/**/*.hbs'
            ],
            dest: 'app/templates/templates.js'
          }
        ]
      }
    },
    less: {
      dev: {
        options: {
          baseUrl: 'app',
          src: [
            'app/core/**/*.less',
            'app/modules/**/*.less',
            'app/plugins/**/*.less',
            'app/libraries/**/*.less'
          ],
          paths: 'app/core/less',
          generateSourceMaps: true,
          compress: false,
          dest: 'build/css',
          cssFilename: 'adapt.css',
          mapFilename: 'adapt.css.map'
        }
      },
      compile: {
        options: {
          baseUrl: 'app',
          src: [
            'app/core/**/*.less',
            'app/less/**/*.less',
            'app/modules/**/*.less',
            'app/plugins/**/*.less',
            'app/libraries/**/*.less'
          ],
          paths: 'app/core/less',
          generateSourceMaps: false,
          compress: true,
          dest: 'build/css',
          cssFilename: 'adapt.css',
          mapFilename: 'adapt.css.map'
        }
      }
    },
    mochaTest: {
      src: ['test/*.js'],
      options: {
        reporter: 'spec',
        timeout: 3500
      }
    },
    requireBundle: {
      modules: {
        src: 'app/modules/*',
        dest: 'app/modules/modules.js'
      },
      plugins: {
        src: 'app/plugins/*',
        dest: 'app/plugins/plugins.js'
      }
    },
    requirejs: {
      dev: {
        options: {
          baseUrl: 'app',
          name: 'core/app',
          mainConfigFile: "app/core/config.js",
          out: "build/js/origin.js",
          preserveLicenseComments: true,
          optimize: "none"
        }
      },
      compile: {
        options: {
          baseUrl: 'app',
          name: 'core/app',
          mainConfigFile: "app/core/config.js",
          out: "build/js/origin.js",
          optimize: "none"
        }
      }
    }
  });

  grunt.registerTask('migration-conf', 'Creating migration Conf', function() {
    var mongoUri = require('mongodb-uri');
    var config = grunt.file.readJSON('conf/config.json');
    var connectionString = '';

    if (config.dbConnectionUri) {
      connectionString = config.dbConnectionUri;

      var dbConnectionUriParsed = mongoUri.parse(connectionString);
      dbConnectionUriParsed.database = config.dbName;
      connectionString = mongoUri.format(dbConnectionUriParsed);

    } else {
      // Construct the authentication part of the connection string.
      var authenticationString = config.dbUser && config.dbPass ? config.dbUser + ':' + config.dbPass + '@' : '';

      // Check if a MongoDB replicaset array has been specified.
      if (config.dbReplicaset && Array.isArray(config.dbReplicaset) && config.dbReplicaset.length !== 0) {
        // The replicaset should contain an array of hosts and ports
        connectionString = 'mongodb://' + authenticationString + config.dbReplicaset.join(',') + '/' + config.dbName;
      } else {
        // Get the host and port number from the configuration.

        var portString = config.dbPort ? ':' + config.dbPort : '';

        connectionString = 'mongodb://' + authenticationString + config.dbHost + portString + '/' + config.dbName;
      }
      if (typeof config.dbAuthSource === 'string' && config.dbAuthSource !== '' ) {
        connectionString += '?authSource=' + config.dbAuthSource;
      }
    }
    var migrateConf = {
      migrationsDir : 'migrations/lib',
      es6 : false,
      dbConnectionUri: connectionString
    };
    grunt.file.write('conf/migrate.json', JSON.stringify(migrateConf, null, 2));
  });

  // Compiles frontend plugins
  grunt.registerMultiTask('requireBundle', 'Generates a .js file with a bunch of imports for the path files', function() {
    var modulePaths = '';
    // Go through each subfolder in the plugins directory
    var foldersArray = grunt.file.expand({ filter: "isDirectory" }, this.data.src);
    // Check if any plugins are available
    if (foldersArray.length === 0) {
      modulePaths += "'";
    }
    foldersArray.forEach(function(path, index, folders) {
      // Strip off front of path to make relative path to config file
      var relativePath = path.replace(grunt.config.get('requirejs').dev.options.baseUrl, '').slice(1);
      var splitter = "','";
      if (index === folders.length - 1) splitter = "'";
      modulePaths += relativePath + '/index' + splitter;
    });
    grunt.file.write(this.data.dest, "define(['" + modulePaths +"], function() {});");
  });

  grunt.registerMultiTask('less', 'Compile Less files to CSS', function() {
    var path = require('path');
    var less = require('less');
    var options = this.options({});
    var shouldGenerateSourceMaps = options.generateSourceMaps;
    var destination = options.dest;
    var mapFilename = options.mapFilename;
    var imports = getImports();
    var lessOptions = getLessOptions();
    var sourceMapPath = path.join(destination, mapFilename);
    var importsPath = sourceMapPath + '.imports';
    var done = this.async();

    if (!shouldGenerateSourceMaps) removeSourceMaps();

    less.render(imports, lessOptions, complete);

    function getImports() {
      var src = options.src;
      var ret = '';

      for (var i = 0, l = src.length; i < l; i++) {
        grunt.file.expand({
          filter: options.filter,
          follow: true
        }, src[i]).forEach(function(lessPath) {
          ret += '@import \'' + path.normalize(lessPath) + '\';\n';
        });
      }
      return ret;
    }

    function getLessOptions() {
      var ret = {
        compress: options.compress,
        paths: options.paths
      };
      if (shouldGenerateSourceMaps) {
        ret.sourceMap = {
          'sourceMapFileInline': false,
          'outputSourceFiles': true,
          'sourceMapBasepath': 'src',
          'sourceMapURL': mapFilename
        };
      }
      return ret;
    }

    function removeSourceMaps() {
      if (grunt.file.exists(sourceMapPath)) {
        grunt.file.delete(sourceMapPath, { force: true });
      }
      if (grunt.file.exists(importsPath)) {
        grunt.file.delete(importsPath, { force: true });
      }
    }

    function complete(error, output) {
      if (error) return grunt.fail.fatal(JSON.stringify(error, false, ' '));

      var outputMap = output.map;

      if (outputMap) {
        grunt.file.write(sourceMapPath, outputMap);
        grunt.file.write(importsPath, imports);
      }
      grunt.file.write(path.join(destination, options.cssFilename), output.css);
      done();
    }
  });
  grunt.registerTask('generate-lang-json', function() {
    const fs = require('fs-extra');
    const path = require('path');

    const options = this.options();
    const backendGlob = path.join(options.src.backend, `*${options.langFileExt}`);
    const dest = options.dest;
    // load each route lang file
    /**
    * NOTE there must be a file in routes/lang for the language to be loaded,
    * won't work if you've only got lang files in frontend
    */
    grunt.file.expand({}, path.join(backendGlob)).forEach(backendPath => {
      const basename = path.basename(backendPath);
      const frontendGlob = path.join(options.src.frontend, basename);
      let data = { ...fs.readJSONSync(backendPath) };
      // load all matching frontend lang files
      grunt.file.expand({}, frontendGlob).forEach(frontendPath => {
        data = { ...data, ...fs.readJSONSync(frontendPath) };
      });
      fs.ensureDirSync(dest);
      fs.writeJSONSync(path.join(dest, basename), data, { spaces: 2 });
    });
  });

  grunt.registerTask('default', ['build:dev']);
  grunt.registerTask('test', ['mochaTest']);

  /**
  * Accepts 'build' and 'prod' params
  * e.g. grunt build:prod
  */
  grunt.registerTask('build', 'Running build', function(mode) {
    grunt.log.subhead(`Building application in ${mode === 'prod' ? 'production' : 'dev'} mode`);

    var isProduction = mode === 'prod' ? true : false;
    var compilation = isProduction ? 'compile' : 'dev';

    try {
      // add flag to config
      var configFile = 'conf/config.json';
      var config = grunt.file.readJSON(configFile);
      config.isProduction = isProduction;
      grunt.file.write(configFile, JSON.stringify(config, null, 2));
      // run the task
      grunt.task.run(['migration-conf', 'requireBundle', 'generate-lang-json', 'copy', 'less:' + compilation, 'handlebars', 'requirejs:'+ compilation, `babel:${compilation}`]);
    } catch(e) {
      grunt.task.run(['requireBundle', 'copy', 'less:' + compilation, 'handlebars', 'requirejs:' + compilation, `babel:${compilation}`]);
    }
  });
};
