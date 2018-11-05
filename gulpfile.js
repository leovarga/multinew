var translate = require('gulp-translator');
var include   = require("gulp-include");
const gulp = require('gulp');

var options = {
	localeDirectory: './src/locales/',
	localeExt: '.yml',
	transform: {
		escapeQuotes: (content, dict) => content.replace(/"/g, '&quot;').replace(/\r?\n/g, ' '),
	}

}

gulp.task('translate', function() {
  var translations = ['ru', 'en' /*, 'ro', 'zh'*/];
 
  gulp.src('./src/router/index.html')
      .pipe( include()
      	.on('error', console.log) )
      .pipe(gulp.dest('./'));
  
  translations.forEach(function(translation){
  	options.lang = translation;
    gulp.src('src/*.html')
      .pipe( include()
      	.on('error', console.log) )
      .pipe(
        translate(options)
        .on('error', function(){
          console.error(arguments);
        })
      )
      .pipe(gulp.dest('./' + translation));
  });
});