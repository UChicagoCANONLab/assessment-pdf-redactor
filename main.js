/* To avoid CORS issues with accessing the worker. */
PDFJS.disableWorker = true;

/* Global Objects */
var pdf = document.getElementById('pdf_input');
var percent_obj = document.getElementById('wait_time');
var o_pdf = new jsPDF("p", "mm", "a4" );

/* Global Vars */
var INCHES = 1;
var SAVE_NAME;
var LOADING_PERCENT = 0;
var PERCENT_INCREMENT = 0;
var STAGED = false;

/* 
  PDF READING/WRITING
*/

/* Prevents input box from staying highlighted once clicked. */
pdf.onclick = function() {
  document.getElementById('pdf_input').blur();
}

/* Handle crop/download button. */
document.getElementById('redact_button').onclick = function() {
  document.getElementById('redact_button').blur();

  /* If the pdf has already been cropped, download the file 
     on click. */
  if(STAGED) {
    console.log("downloading");
    o_pdf.save(SAVE_NAME);
    return;
  }
  
  /* Init relevant globals. */
  LOADING_PERCENT = 0;
  INCHES = getInches();

  /* Check for invalid input of any form. */
  if(!pdf.files[0]) {
    fileError();
    return;
  }
  if(['application/pdf'].indexOf(pdf.files[0].type) == -1) {
    pdfError();
    return;
  }
  if(!INCHES) {
    numberError();
    return;
  }
  if(INCHES < 0) {
    lowerBoundError();
    return;
  }
  if(INCHES > 11) {
    upperBoundError();
    return;
  }

  /* Get file from input box, update HTML. */
  file = pdf.files[0] 
  document.getElementById("process_status").style.color = "black";
  document.getElementById('process_status').innerHTML = "Processing... For better performance, stay on this tab.";
  updatePercent(0);

  /* Crop PDF. */
  fileReader = new FileReader();
  fileReader.onload = function(ev) {
    SAVE_NAME = "CROPPED_" + pdf.files[0].name;

    /* On file load: */
    PDFJS.getDocument(fileReader.result).then(function (pdf) {
      
      console.log(pdf)
      PERCENT_INCREMENT = 100 / pdf.numPages;
      var page_promise = 1;
      var prom_list = [];

      /* Make list of promises, one for each page to be cropped. */
      for(var i = 1; i <= pdf.numPages; i++) {
        console.log("start");
        page_promise = loadPage(pdf,i,page_promise);
        prom_list.push(new Promise((resolve, reject) => {resolve(page_promise)})); 
      
      }

      /* Update HTML when all promises resolve (doc is completely cropped). */
      Promise.all(prom_list).then(function() {
      
        document.getElementById('redact_button').value = "Download";
        STAGED = true;
        document.getElementById("process_status").style.color = "black";
        document.getElementById('process_status').innerHTML = 'Done. Please refresh the page to crop another file.'
        percent_obj.innerHTML = "";

      })

    });
  };
  fileReader.readAsArrayBuffer(file);

};

/* Load page, return promise to crop page. */
async function loadPage(pdf, i, prom) {

  await prom;
  if(i > 1) {
    o_pdf.addPage();
  }
  return pdf.getPage(i).then(function(page) {
      return (new Promise((resolve, reject) => {resolve(convertPage(page, i))}));
    });
}

/* Crop page, return promise. */
function convertPage(page, i) {

  /* Scale determines resolution - higher number, better res. */
  var scale = 2;

  /* Create new canvas. */
  var viewport = page.getViewport(scale);
  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  /* Render PDF as canvas. */
  var task = page.render({canvasContext: context, viewport: viewport});

  return task.promise.then(function(){

    /* Crop canvas and render as image. */
    var imgCrop = new Image();
    imgCrop.src = getImagePortion(canvas, canvas.width, canvas.height, 0, (canvas.height * (INCHES/11)), 1);

    /* Paste cropped image to new PDF. */
    o_pdf.setPage(i);
    o_pdf.addImage(imgCrop, 'JPEG', 0,0, 210, 297);
  
    /* Update loading progress. */
    console.log("page saved");
    console.log(PERCENT_INCREMENT);
    updatePercent(PERCENT_INCREMENT);

  });
}

/* Returns new canvas with only cropped portion. */
function getImagePortion(imgObj, newWidth, newHeight, startX, startY, ratio) {
  var retCanvas = document.createElement('canvas');
  var retContext = retCanvas.getContext('2d');
  retCanvas.width = newWidth; retCanvas.height = newHeight;
  
  var bufferCanvas = document.createElement('canvas');
  var bufferContext = bufferCanvas.getContext('2d');
  bufferCanvas.width = imgObj.width;
  bufferCanvas.height = imgObj.height;
  bufferContext.drawImage(imgObj, 0, 0);

  retContext.drawImage(bufferCanvas, startX,startY,newWidth * ratio, newHeight * ratio,0,0,newWidth,newHeight);
  return retCanvas.toDataURL();
}

/* 
  HTML READING/WRITING
*/

/* Read inches from text input box. */
function getInches() {
  var inches = document.getElementById('inches_input').value;
  if(Number(inches)) {
    inches = Number(inches);
  }
  else if(inches == "" || !inches) {
    inches = 1;
  }
  else {
    inches = NaN;
  }
  return inches;
}

/* Check that selected file is pdf. */
pdf.onchange = function(ev) {
  if(['application/pdf'].indexOf(pdf.files[0].type) == -1) {
    pdfError();
    return;
  }
  else {
    document.getElementById('process_status').innerHTML = "";
  }
};

/* Update loading progress. */
function updatePercent(inc) {
  if(LOADING_PERCENT < 100) {
    LOADING_PERCENT += inc;
  }

  percent_obj.innerHTML = Math.round(LOADING_PERCENT) + "%";
  console.log(percent_obj.innerHTML);
}

/* 
  ERRORS 
*/

function pdfError() {
  document.getElementById("process_status").style.color = "red";
  document.getElementById('process_status').innerHTML = "Error: not a PDF.";
}

function numberError() {
  document.getElementById("process_status").style.color = "red";
  document.getElementById('process_status').innerHTML = "Error: invalid number.";
}

function lowerBoundError() {
  document.getElementById("process_status").style.color = "red";
  document.getElementById('process_status').innerHTML = "Error: number must be greater than or equal to 0.";
}

function upperBoundError() {
  document.getElementById("process_status").style.color = "red";
  document.getElementById('process_status').innerHTML = "Error: number must be less than or equal to 11.";
}

function fileError() {
  document.getElementById("process_status").style.color = "red";
  document.getElementById('process_status').innerHTML = "Error: no file.";
}

function noError() {
   document.getElementById('process_status').innerHTML = "";
}

