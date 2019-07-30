
var NGRAM = 3;

function onInstall(e) {
  createNamesSheet(); //only create 'Names' sheet on install - user is free to delete
  onOpen(e);
}

function onOpen(e) {
  if (e && e.authMode != ScriptApp.AuthMode.NONE) {
    setup();
  }
  
  //set menu
  SpreadsheetApp.getUi()
    .createMenu('Text Randomizer')
    .addItem('Open', 'showSidebar')
    .addItem('View reference', 'showReferenceDialog')
    .addItem('Load examples', 'loadExampleData')
    .addToUi();
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

function setup() {
  //ensure sheets named 'Endpoints' exists
  var spreadsheet = SpreadsheetApp.getActive();
  
  var sheetName = 'Endpoints';
  var endpointsSheet = spreadsheet.getSheetByName(sheetName);
  if (endpointsSheet) {
    endpointsSheet.activate();
  } else {
    endpointsSheet = spreadsheet.insertSheet(sheetName, 0);
    endpointsSheet.setFrozenRows(1);
  }
}

function createNamesSheet() {
  //ensure sheets named 'Names' exists
  var spreadsheet = SpreadsheetApp.getActive();
  var sheetName = 'Names';
  var namesSheet = spreadsheet.getSheetByName(sheetName);
  if (namesSheet) {
    //do nothing
  } else {
    namesSheet = spreadsheet.insertSheet(sheetName, 0);
    namesSheet.setFrozenRows(1);
  }
}
    
function showSidebar() {
  var template = HtmlService.createTemplateFromFile('Sidebar')
  template.endpoints = getEndpointHeaders();
  var html = template.evaluate()
    .setTitle('Text Randomizer');
  SpreadsheetApp.getUi().showSidebar(html);
}

function showReferenceDialog() {
  var template = HtmlService.createTemplateFromFile('ReferenceDialog')
  var html = template.evaluate()
    .setTitle('How to use Text Randomizer')
    .setWidth(600)
    .setHeight(300);
  SpreadsheetApp.getActiveSpreadsheet().show(html);
}

function loadExampleData() {
  var spreadsheet = SpreadsheetApp.getActive();
  
  //create and populate example sheet
  var exampleSheet = spreadsheet.insertSheet('Example Sheet', 0);
  exampleSheet.setFrozenRows(1);
  exampleSheet.insertColumnsBefore(1, 2);//insert 2 columns before the first column
  var values = [
    ["rare_gem", "treasure"],
    ["diamond" , "a magic ring"],
    ["ruby" , "a sparkling {rare_gem}"],
    ["black opal" , "{#200-300} {[grubby copper|silver|gold]} coins"],
    ["sapphire" , "a crown with a small {@crown_gem:rare_gem} on each point, and a huge {@crown_gem} in the center"],
    ["moonstone" , "the fabled sword {sword_name}"],
  ];
  var range = exampleSheet.getRange(1,1,6,2);
  range.setValues(values);
  
  createNamesSheet();//ensure Names sheet exist
  //populate names sheet
  var namesSheet = spreadsheet.getSheetByName('Names');
  namesSheet.insertColumnsBefore(1, 2);
  values = [
    ["sword_name", "monster_name"],
    ["excalibur" , "balrog"],
    ["callandor" , "dracula"],
    ["longclaw" , "godzilla"],
    ["stormbringer" , "falkor"],
    ["glamdring" , "modron"],
  ];
  range = namesSheet.getRange(1,1,6,2);
  range.setValues(values);
  
  setup();//ensure Endpoints sheet exist
  //populate endpoints sheet
  var endpointsSheet = spreadsheet.getSheetByName('Endpoints');
  endpointsSheet.insertColumnsBefore(1, 3);
  values = [
    ["Single Treasure", "Treasure Hoard", "Monster"],
    ["{treasure}" , "{treasure}, ", "The dreaded {monster_name}"],
    ["" , "{treasure}, ", ""],
    ["" , "and {treasure}", ""],
  ];
  range = endpointsSheet.getRange(1,1,4,3);
  range.setValues(values);
}

function getEndpointHeaders() {
  var spreadsheet = SpreadsheetApp.getActive();
  var endpointsSheet = spreadsheet.getSheetByName('Endpoints');
  var headers = endpointsSheet.getRange(1,1,1,endpointsSheet.getLastColumn()).getValues()[0];
  return headers.map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
}

function getData() {
  var spreadsheet = SpreadsheetApp.getActive();
  var sheets = spreadsheet.getSheets();
  
  var randomizerChoices = {};
  var namesCorpora = {};
  
  //for each sheet
  for (var i = 0; i < sheets.length; i++) {
    
    var isEndpointSheet = sheets[i].getName() == 'Endpoints';
    var isNamesSheet = sheets[i].getName() == 'Names';
    
    var values = sheets[i].getDataRange().getValues();
    
    //for each column
    for (var j = 0; j < values[0].length; j++) {
      
      //if column header is blank, items will be inaccessible (skip)
      if (values[0][j].toString().trim().length == 0) continue;
      
      //set keys from column headers
      if (isNamesSheet) {
        namesCorpora[values[0][j].toString()] = {};
      } else {
        randomizerChoices[values[0][j].toString()] = [];
      }
    
      var endpointOutput = '';
      var markovChain = {'<s>':[]};
      
      //for each row
      for (var k = 1; k < values.length; k++) {
        if (values[k][j].toString().trim() != '') {
          if (isEndpointSheet) {
            //construct output string
            endpointOutput += values[k][j] + '\n';
          } else if (isNamesSheet) {
            //build markov chain
            var name = values[k][j].toString().trim().toLowerCase();
            if (!name.match(/[aeiouy]+/)) throw ('name ' + values[k][j] + ' from Names sheet is invalid - must contain at least one vowel to ensure pronounceability');
            
            //start symbol
            markovChain['<s>'].push(name.substring(0, NGRAM - 1));
            
            for (var idx = 0; idx <= name.length - NGRAM; idx++) {
              var key = name.substring(idx, idx + NGRAM - 1);
              var value = name.charAt(idx + NGRAM - 1);
              if (markovChain.hasOwnProperty(key)) {
                markovChain[key].push(value);
              } else {
                markovChain[key] = [value];
              }
            }
            
            //terminal symbol
            var lastKey = name.substring(name.length - NGRAM + 1);
            if (markovChain.hasOwnProperty(lastKey)){
              markovChain[lastKey].push('</s>');
            } else {
              markovChain[lastKey] = ['</s>'];
            }
            
          } else {
            randomizerChoices[values[0][j].toString()].push(values[k][j].toString()); 
          }
        }
      }
      if (isEndpointSheet) {
        randomizerChoices[values[0][j].toString()].push(endpointOutput);
      } else if (isNamesSheet) {
        namesCorpora[values[0][j].toString()] = markovChain;
      }
    }
  }
  
  var data = {
    'randomizer_choices' : randomizerChoices,
    'names_corpora' : namesCorpora
  };
  return data;
}