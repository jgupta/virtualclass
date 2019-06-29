// This file is part of Vidyamantra - http:www.vidyamantra.com/
/** @Copyright 2014  Vidya Mantra EduSystems Pvt. Ltd.
 * @author  Suman Bogati <http://www.vidyamantra.com>
 */
(function (window) {
  const readyTextObj = function () {
    return {
      init(boxCont) {
        // this.textId =  0;
        this.prevTextObj = '';
        this.currTextObjWrapper = '';
        //						this.keyTyped = []; //the key typed by user this is used into finalizeText()
        this.currObject = {};
        this.prvModTextObj = {};
        this.prvCurrTransform = {};
        this.textWriteMode = 0;
        this.totalBox = 0;
        this.boxContainer = boxCont;
        this.muser = false;
      },
      /**
       *
       * This function handles all the functionality of text object
       * Eg: created the text wrapper for creating text, create text, create the text with older one
       * @param startPosX points out the x co-ordination of canvas after clicked by user
       * @param startPosY points out the y co-ordination of canvas after clicked by user
       * @returns nothing
       */
      textUtility(startPosX, startPosY, mtext) {
        console.log(`Text position x=${startPosX} y=${startPosY}`);
        this.startPosX = startPosX;
        this.startPosY = startPosY;
        // alert('is there anything for you');
        const { vcan } = virtualclass.wb[virtualclass.gObj.currWb];
        const ctx = vcan.main.canvas.getContext('2d');
        var obj = {};
        this.textWriteMode++;
        this.wmode = true;

        if (vcan.main.currentTransform != undefined && vcan.main.currentTransform != '') {
          this.currObject = vcan.main.currentTransform.target;
          if (this.currObject != undefined && this.currObject.type == 'text') {
            obj = {
              width: 300,
              height: 100,
              x: this.currObject.oCoords.tl.x,
              y: this.currObject.oCoords.tl.y,
              text: this.currObject.text,
            };
            if (!virtualclass.wb[virtualclass.gObj.currWb].utility.clickOutSidebox(this.textWriteMode)) {
              // virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.drawTextBoxWrapper(ctx, obj,  this.currObject.id);
              virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.drawTextBoxWrapper(obj, this.currObject.id);
            }
            vcan.main.currentTransform = '';
          }

          if (virtualclass.wb[virtualclass.gObj.currWb].utility.clickOutSidebox(this.textWriteMode)) {
            virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.renderText(this.prvCurrTransform, this.prvModTextObj, ctx);
          }

          if (this.currObject != undefined && this.currObject.type == 'text') {
            // the height and width shoudl be dyanamic
            obj = {
              width: 300,
              height: 100,
              x: this.currObject.oCoords.tl.x,
              y: this.currObject.oCoords.tl.y,
              text: this.currObject.text,
            };
            this.prvModTextObj = {
              prvObjId: this.currObject.id,
              prvText: this.currObject.text,
              x: this.currObject.x,
              y: this.currObject.y,
            };
            this.prvTextObj = this.currObject;
          }
          this.prvCurrTransform = this.currObject;
        } else if (virtualclass.wb[virtualclass.gObj.currWb].utility.clickOutSidebox(this.textWriteMode)) {
          if (typeof mtext !== 'undefined') {
            virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.renderText(this.currObject, this.prvModTextObj, ctx, mtext);
          } else {
            virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.renderText(this.currObject, this.prvModTextObj, ctx);
          }
        } else {
          this.totalBox++;
          var obj = {
            x: startPosX, y: startPosY, width: 300, height: 100,
          };
          // virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.drawTextBoxWrapper(ctx, obj,  this.totalBox);
          if (typeof mtext === 'undefined') {
            virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.drawTextBoxWrapper(obj, this.totalBox);
          } else {
            virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.drawTextBoxWrapper(obj, this.totalBox, mtext);
          }
        }
      },
      /**
       * It draws the textarea wrapper for draw the text inside it
       * @param ctx the canvas's context on which the box is being drawn
       * @param obj contains the information about contianer for example x, y,
       * width and height, the object contains the text also if it available
       * @param boxNumber the number of box till now created
       * @returns nothing
       */
      drawTextBoxWrapper(obj, boxNumber, mtext) {
        const boxWidth = 350;
        // var viewPort = document.querySelector('#vcanvas' + virtualclass.gObj.currWb);
        // if(viewPort != null ){
        //     var offsetWidth = viewPort.offsetWidth; // 900
        //     var posDiff = (viewPort.offsetWidth - obj.x);
        //     if(posDiff < boxWidth){
        //         obj.x =  obj.x - boxWidth  - posDiff;
        //     }
        // }

        virtualclass.vutil.removeAllTextWrapper();
        const { vcan } = virtualclass.wb[virtualclass.gObj.currWb];
        const divNode = document.createElement('div');
        divNode.id = `box${boxNumber}`;
        divNode.className = 'textBoxContainer';
        divNode.style.position = 'absolute';

        divNode.style.left = `${obj.x - virtualclass.leftPosX}px`;
        divNode.style.top = `${obj.y - virtualclass.topPosY}px`;

        if (obj.x != undefined) {
          var textNode = document.createElement('textarea');

          textNode.id = `${divNode.id}textarea`;
          textNode.className = 'whiteBoardTextBox';


          textNode.rows = 8;
          textNode.cols = 41;
          if (obj.text != undefined && obj.text != '') {
            textNode.value = obj.text;
          }


          divNode.appendChild(textNode);

          document.getElementById(this.boxContainer).appendChild(divNode);
        }
        this.prevTextObj = divNode;
        this.currTextObjWrapper = obj;
        this.prevTextObj.measure = obj;
        virtualclass.wb[virtualclass.gObj.currWb].utility.toolWrapperDisable(true);

        if (!roles.hasControls()) {
          textNode.style.display = 'none';
          if (roles.hasAdmin()) {
            virtualclass.wb[virtualclass.gObj.currWb].utility.toolWrapperEnable(true);
          }
        }

        console.log('Text Command:- Create text wrapper box');
      },
      /**
       * The function renders the text after typed by user into textarea
       * It removes the older text object on which user would clicked for udate the text
       * @param currObject is the object which is ready to be printed
       * @param prvModTextObj
       * @param ctx is the current canvas context
       * @returns nothing
       */
      renderText(currObject, prvModTextObj, ctx, mtext) {
        const { vcan } = virtualclass.wb[virtualclass.gObj.currWb];
        if (this.prevTextObj != '') {
          if (!virtualclass.wb[virtualclass.gObj.currWb].utility.IsObjEmpty(currObject)) {
            for (let i = 0; i < vcan.main.children.length; i++) {
              if (currObject.id == vcan.main.children[i].id) {
                vcan.main.children.splice(i, 1);
                this.currObject = '';
                break;
              }
            }
          }

          if (!virtualclass.wb[virtualclass.gObj.currWb].utility.IsObjEmpty(currObject)) {
            if (typeof mtext !== 'undefined') {
              this.finalizeText(ctx, this.prevTextObj, prvModTextObj, mtext);
            } else {
              this.finalizeText(ctx, this.prevTextObj, prvModTextObj);
            }
          } else if (typeof mtext !== 'undefined') {
            this.finalizeText(ctx, this.prevTextObj, 'undefined', mtext);
          } else {
            this.finalizeText(ctx, this.prevTextObj);
          }

          virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.wmode = false;
        }
      },
      /**
       * This function actually draws the text of passed wrapper for textarea
       * @param ctx the conext on which the text is drawing
       * @param txtWrapper The text wrapper which has text and it's wrapper to be drawn
       * @param prvModObj if text wrapper has previous text eg 'vidya' new one is vidymantra
       * then prvModObj contains the vidya other info x, y
       * @returns nothing
       */
      finalizeText(ctx, txtWrapper, prvModObj, mtext) {
        const { vcan } = virtualclass.wb[virtualclass.gObj.currWb];
        const prvNode = document.getElementById(txtWrapper.id);
        let userText = '';
        if (typeof mtext === 'undefined') {
          const textarea = prvNode.getElementsByTagName('textarea');
          for (var i = 0; i < textarea.length; i++) {
            if (textarea[i].id == `${prvNode.id}textarea`) {
              userText = textarea[i].value;
              break;
            }
          }
        } else {
          userText = mtext;
        }

        const fontSize = 20;
        ctx.font = `${fontSize}px Times New Roman`;
        ctx.fillStyle = this.prvCurrTransform.color;
        let maxWidth = 0;
        const tempUserTextArr = userText.split(/\r?\n/);
        maxWidth = ctx.measureText(tempUserTextArr[0]).width + 20;
        // var extHeight = 15; //TODO this should be changed according to font size by selected user
        let extHeight = 15;
        for (var i = 1; i < tempUserTextArr.length; i++) {
          extHeight += 15;
          const tempMaxWidth = ctx.measureText(tempUserTextArr[i]).width;
          if (tempMaxWidth > maxWidth) {
            maxWidth = tempMaxWidth;
          }
        }

        const textHalfWidth = maxWidth / 2;
        const currTime = new Date().getTime();
        const textObj = {
          type: 'text',
          text: userText,
          x: txtWrapper.measure.x + (textHalfWidth * virtualclass.zoom.canvasScale),
          y: txtWrapper.measure.y + (extHeight * virtualclass.zoom.canvasScale),
          fontSize,
          fontWidth: ctx.measureText(userText).width,
          // textArr : this.keyTyped, //this should add after called the function canvas.addObject(text)
          mp: { x: txtWrapper.measure.x, y: txtWrapper.measure.y },
        };

        if (virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.muser == false) {
          const obj = {
            mt: currTime,
            ac: 'd',
            x: this.startPosX,
            y: this.startPosY,
            mtext: textObj.text,
          };
          virtualclass.wb[virtualclass.gObj.currWb].uid++;
          obj.uid = virtualclass.wb[virtualclass.gObj.currWb].uid;
          vcan.main.replayObjs.push(obj);
         // virtualclass.storage.store(JSON.stringify(vcan.main.replayObjs));
          virtualclass.vutil.beforeSend({ repObj: [obj], cf: 'repObj' });
        }

        const text = virtualclass.wb[virtualclass.gObj.currWb].canvas.readyObject(textObj);
        const tempObj = text.coreObj;
        console.log(`Whiteboard text ${text}`);
        virtualclass.wb[virtualclass.gObj.currWb].canvas.addObject(text);

        const lastTxtObj = vcan.main.children[vcan.main.children.length - 1];
        lastTxtObj.mt = currTime;

        prvNode.parentNode.removeChild(txtWrapper);
        vcan.renderAll();

        virtualclass.wb[virtualclass.gObj.currWb].utility.toolWrapperEnable(true);
      },

      finalizeTextIfAny(midReclaim) {
        const canvasWrapper = document.getElementById(`canvasWrapper${virtualclass.gObj.currWb}`);
        if (canvasWrapper != null) {
          let textBox = canvasWrapper.getElementsByClassName('whiteBoardTextBox');
          if (textBox.length > 0) {
            textBox = textBox[0];
            if (typeof midReclaim === 'undefined' || (typeof midReclaim !== 'undefined') && virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.textWriteMode % 2 != 0) {
              virtualclass.wb[virtualclass.gObj.currWb].obj.drawTextObj.textUtility();
            }
          }
        }
      },
    };
  };
  window.readyTextObj = readyTextObj;
}(window));
