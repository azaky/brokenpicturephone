// This script converts images to base64 in-place.
// Open the html via a browser, open developer's console, and paste the following script.
// Then save the webpage.

// https://stackoverflow.com/a/20285053
const toDataURL = url => new Promise(resolve => {
  var xhr = new XMLHttpRequest();
  xhr.onload = function() {
    var reader = new FileReader();
    reader.onloadend = function() {
      resolve(reader.result);
    }
    reader.readAsDataURL(xhr.response);
  };
  xhr.open('GET', url);
  xhr.responseType = 'blob';
  xhr.send();
});

[...document.getElementsByTagName('img')].forEach(img => {
  toDataURL(img.src).then(base64 => img.src = base64);
});
