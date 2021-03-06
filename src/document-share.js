// This file is part of Vidyamantra - http:www.vidyamantra.com/
/** @Copyright 2017  Vidya Mantra EduSystems Pvt. Ltd.
 * @author  Suman Bogati <http://www.vidyamantra.com>
 * This file is responsible for sharing the document, it responsible for
 * upload the docs, re-arrangement, disable and delete sending doc to the server and receiving from server
 * It display the docs from localstorage if exist otherwise request the docs to the server
 */

(function (window) {
  let firstTime = true;
  const { io } = window;
  const documentShare = function () {
    return {
      allPages: null,
      allNotes: null, // this contains all notes received from server
      allDocs: null, // This contains all docs received from server
      notes: null,
      order: [],
      tempFolder: 'documentSharing',

      async init() {
        this.pages = {};
        this.notes = {};
        firstTime = true;
        this.indexNav = new virtualclass.pageIndexNav('documentShare');
        this.UI.container();
        if (roles.hasControls() && virtualclass.config.makeWebSocketReady) {
          ioAdapter.mustSend({ dts: { init: 'studentlayout' }, cf: 'dts' });
          virtualclass.serverData.syncAllData();
        }
        await this.afterFirstRequestDocs(virtualclass.serverData.rawData.docs);
        (virtualclass.dts.noteExist()) ? virtualclass.modal.hideModal() : virtualclass.modal.showModal();
      },

      moveProgressbar() {
        const cont = document.querySelector('#docsUploadMsz');
        const msz = document.querySelector('#docsuploadContainer .qq-upload-list-selector.qq-upload-list');
        if (msz) {
          msz.style.display = 'block';
          const divCont = document.createElement('div');
          cont.appendChild(divCont);
          divCont.appendChild(msz);
        }
      },

      /**
       * This function displays the current note on screen
       * and highlight the naviation of that screen
       */
      setNoteScreen(docsObj) {
        if (document.querySelector(`#note${docsObj.slideNumber}.current.note`) == null) {
          const doc = this.getDocId(docsObj.slideNumber);
          this.docs.executeScreen(doc, 'fromreload', undefined, docsObj.slideNumber);
          this.setScreenByOrder(doc);
        }
      },

      /**
       * This display the notes acorrding to order
       * Whatever the order will be on this.order,
       * there will be display the notes according to this
       */
      setScreenByOrder(currDoc) {
        if (this.order != null && this.order.length > 0) {
          const allNotes = this.getAllNotes(this.order);
          let docId;
          for (var i = 0; i < allNotes.length; i++) {
            docId = allNotes[i].id.split('_')[0];
            this.setLinkSelected(docId, 1);
          }
          // remove if there is already pages before render the ordering elements
          const alreadyElements = document.querySelectorAll('#notesContainer .note');
          this.createNoteLayout(allNotes, currDoc);

          this.reArrangeNotes(this.order);

          // TODO This should be improve at later, should handle at function createNoteNav
          for (var i = 0; i < this.order.length; i++) {
            this.noteStatus(this.order[i], this.allNotes[this.order[i]].status);
          }
        }
      },

      createNoteLayout(notes, currDoc) {
        let mainContainer; var tempCont; let objTemp; let template; let
          tempHtml;
        const allNotes = [];
        for (let i = 0; i < notes.length; i++) {
          if (!Object.prototype.hasOwnProperty.call(notes[i], 'deletedn')) {
            allNotes.push(notes[i]);
          }
        }
        if (allNotes.length > 0) {
          const pageContainer = document.querySelector('#screen-docs .pageContainer');
          // this.UI.createSlides(pageContainer, allNotes);
          if (pageContainer == null) {
            var tempCont = { notes: allNotes, hasControls: roles.hasControls(), cd: currDoc };
            template = 'screen';
            mainContainer = document.querySelector('#docScreenContainer');
          } else {
            tempCont = { notes: allNotes };
            template = 'notesMain';
            mainContainer = document.querySelector('#screen-docs #notesContainer');
          }

          template = virtualclass.getTemplate(template, 'documentSharing');
          tempHtml = template(tempCont);

          if (mainContainer != null) {
            mainContainer.insertAdjacentHTML('beforeend', tempHtml);
          } else {
            // console.log('there is no such element');
          }
          if (!roles.hasControls()) {
            virtualclass.vutil.showZoom();
          }
        }
      },

      /**
       * This function is trigger after upload the doc,
       * create the intance of page/navigation from this page
       */
      afterUploadFile(doc) {
        if (roles.hasControls()) {
          this.createPageForNavigation(doc);
          virtualclass.serverData.pollingStatus().then(() => { virtualclass.dts.afterConverted(); });
        }
      },

      /**
       * It creates the instance for doc which is uploaded to LMS
       * @param id expects the document id
       */
      initDocs(id) {
        if (typeof this.pages[id] !== 'object') {
          let status = 0;
          if (this.allDocs[id].status == 'true' || this.allDocs[id].status == 1) {
            status = 1;
          }
          const docId = `docs${id}`;
          this.pages[docId] = new virtualclass.page('docScreenContainer', 'docs', 'virtualclassDocumentShare', 'dts', status);
          // this.pages[docId].init(id, this.allDocs[id].title);
          this.pages[docId].init(id, this.allDocs[id].filename);
        }
      },

      fetchAllNotes() {
        const allNotes = {};
        for (const key in virtualclass.dts.allDocs) {
          for (let j = 0; j < virtualclass.dts.allDocs[key].notesarr.length; j++) {
            allNotes[virtualclass.dts.allDocs[key].notesarr[j].id] = virtualclass.dts.allDocs[key].notesarr[j];
          }
        }
        return allNotes;
      },

      // calling from both teacher and student
      afterFirstRequestDocs(docs) {
        this.rawToProperData(docs);
        for (const key in this.allDocs) {
          if (!Object.prototype.hasOwnProperty.call(this.allDocs[key], 'deleted')) {
            this.initDocs(this.allDocs[key].fileuuid);
          }
        }

        if (roles.hasAdmin()) {
          if (virtualclass.config.makeWebSocketReady) {
            this.requestOrder(this.executeOrder);
          } else {
            this.executeOrder(virtualclass.gObj.docOrder.docs);
          }
        }
      },

      rawToProperData(docs) {
        this.allDocs = this.convertInObjects(docs);
        this.allNotes = this.fetchAllNotes();
      },

      /**
       * This would be performed after got
       * the request
       * @param docs expects documenation list that have been
       * received from LMS and localstorage
       */
      afterRequestOrder(content) {
        this.order.length = 0;
        this.order = content;
        const doc = this.getDocId(this.order[0]);
        if (Object.prototype.hasOwnProperty.call(virtualclass.dts.allDocs, doc)) {
          const docId = `docs${doc}`;
          // var mainCont = this.pages[docId].UI.mainView.call(this.pages[docId]);
          // console.log(`From database doc share order ${this.order.join(',')}`);
          this.setScreenByOrder(docId);
          this.docs.currNote = this.order[0];
          this.docs.displayScreen(docId, this.order[0]);
        }
      },

      /**
       * this requests the order from LMS
       */
      requestOrder(cb) {
        virtualclass.vutil.requestOrder('docs', cb);
      },

      executeOrder(response) {
        if (response != undefined && typeof response !== 'undefined') {
          if (response.length > 0) {
            if (response === 'Failed' || response === 'Error') {
              // console.log('page order retrieve failed');
              $('#congdashboard').modal();
              // console.log(`dashboard length ${$('#congdashboard').length}`);
              virtualclass.dashBoard.clickCloseButton();
            } else if (response && roles.hasAdmin()) {
              // console.log('==== dts must send order');
              ioAdapter.mustSend({ dts: { order_recived: response }, cf: 'dts' });
              if (virtualclass.currApp === 'DocumentShare') {
                virtualclass.dts.afterRequestOrder(response);
                virtualclass.dts.createNoteNav();
              }
            }
          }
        }
      },

      /**
       * this requests documentation lists from LMS
       */
      getFilenameFromUploadingfiles(doc) {
        for (let i = 0; i < virtualclass.gObj.uploadingFiles.length; i++) {
          return virtualclass.gObj.uploadingFiles[i].name;
        }
      },

      createPageForNavigation(doc) {
        const newDocObj = {
          filename: this.getFilenameFromUploadingfiles(doc),
          fileuuid: doc,
          filepath: 'somewhere',
          filetype: 'doc',
          key_room: `${virtualclass.gObj.sessionInfo.key}_${virtualclass.gObj.sessionInfo.room}`,
          status: 1,
        };

        this.allDocs[doc] = newDocObj;
        let status = 0;
        if (this.allDocs[doc].status == 'true' || this.allDocs[doc].status == 1) {
          status = 1;
        }

        const docId = `docs${doc}`;
        if (typeof this.pages[docId] !== 'object') {
          this.pages[docId] = new virtualclass.page('docScreenContainer', 'docs', 'virtualclassDocumentShare', 'dts', status);
          this.pages[docId].init(doc, this.allDocs[doc].filename);
          if (!Object.prototype.hasOwnProperty.call(this.allDocs[doc], 'notes')) {
            const element = document.querySelector(`#linkdocs${doc}`);
            element.classList.add('noDocs');
          }
        }
      },

      afterConverted() {
        // console.log('polling status done 2');
        virtualclass.dts.afterFirstRequestDocs(virtualclass.serverData.rawData.docs);
        ioAdapter.mustSend({ dts: { fallDocs: true }, cf: 'dts' });
        this.removeNoDocsElem();
      },

      removeNoDocsElem() {
        const allNoDocsElem = document.querySelectorAll('.noDocs');
        for (let i = 0; i < allNoDocsElem.length; i++) {
          allNoDocsElem[i].classList.remove('noDocs');
        }
      },

      requestSlides(filepath) {
        const cthis = this;
        // console.log(`${virtualclass.gObj.currWb} ` + `document share : request ${filepath}`);

        const relativeDocs = this.getDocs(filepath);
        const dsStatus = document.querySelector(`#linkdocs${filepath}`).dataset.selected;

        // console.log('==== dts must send ');
        ioAdapter.mustSend({ dts: { dres: filepath, ds: (1 - (+dsStatus)) }, cf: 'dts' });
        return relativeDocs;
      },

      removeWhiteboardFromStorage(key) {
        virtualclass.storage.wbDataRemove(key);
      },

      getNotes(id) {
        return this.allDocs[id].notesarr;
      },

      removePagesUI(doc) {
        const notes = this.getNotes(doc);
        for (let i = 0; i < notes.length; i++) {
          this._removePageUI(notes[i].id);
        }
        if (this.order.length <= 0) {
          firstTime = true;
        }
        if (roles.hasControls()) {
          this.indexNav.createIndex();
        }
      },

      _removePageUI(noteId, typeDoc) {
        const orderId = this.order.indexOf(noteId);
        if (orderId >= 0) {
          this.order.splice(orderId, 1);
        }
        const note = document.querySelector(`#notesContainer #note${noteId}`);
        if (note != null) {
          note.parentNode.removeChild(note);
        }

        if (typeof virtualclass.wb[`_doc_${noteId}_${noteId}`] === 'object') {
          // delete whiteboard object
          // console.log('Delete whiteboard');
          delete virtualclass.wb[`_doc_${noteId}_${noteId}`];
        }
        this.removeNoteNav(noteId);
        this.reaArrangeThumbCount();
        if (!roles.hasControls()) {
          const curr = document.querySelector('#notesContainer .note.current');
          if (curr) {
            const id = curr.id.split('note')[1];
            virtualclass.dts.indexNav.studentDocNavigation(id);
          } else {
            const cont = document.getElementById('stdPageNo');
            if (cont) {
              cont.innerHTML = 1;
            }
            virtualclass.dts.indexNav.setTotalPages((virtualclass.dts.order.length));
          }
        }
      },

      addPages(slides) {
        let j = 0;
        while (j < slides.length) {
          if (!Object.prototype.hasOwnProperty.call(slides[j], 'deletedn')) {
            if (this.order != null) {
              if (this.order.indexOf(slides[j].id) <= -1) {
                this.order.push(slides[j].id);
              }
            }
          }
          j++;
        }
      },

      toggleSlideWithOrder(doc, slides) {
        const linkDoc = document.querySelector(`#linkdocs${doc}`);
        if (linkDoc != null) {
          if (linkDoc.dataset.selected == 1) {
            linkDoc.dataset.selected = 0;
            return false;
          }
          linkDoc.dataset.selected = 1;
          return true;
        }
        // console.log('Document sharing There is no Element');
      },

      setLinkSelected(doc, val) {
        const linkDoc = document.querySelector(`#linkdocs${doc}`);
        if (linkDoc != null) {
          linkDoc.dataset.selected = val;
        }
      },

      onResponseFiles(doc, slides, docFetch, slide, fromReload) {
        if (firstTime) {
          this.docs.currNote = (typeof slide !== 'undefined') ? slide : slides[0].id; // first id if order is not defined
          firstTime = false;
        }

        if (roles.hasControls()) {
          var addSlide = this.toggleSlideWithOrder(doc, slides);
        } else {
          var addSlide = (typeof docFetch !== 'undefined') ? (+docFetch) : true;
        }

        // var addSlide = this.toggleSlideWithOrder(doc, slides);
        if (addSlide) {
          // TODO, order is fine now, but we have to hanlde this gracefully as done in video and ppt
          this.addPages(slides);

          const cthis = this;
          if (typeof doc !== 'string') {
            var docId = `docs${doc}`;
          } else if (doc.indexOf('docs') >= 0) {
            var docId = doc;
          } else {
            var docId = `docs${doc}`;
          }

          this.createNoteLayout(slides, docId);

          if (typeof slide !== 'undefined') {
            this.docs.displayScreen(docId, slide);
          } else {
            this.docs.displayScreen(docId);
          }


          (typeof fromReload !== 'undefined') ? this.createNoteNav(fromReload) : this.createNoteNav();
          this.updateLinkNotes(this.docs.currNote);
          virtualclass.dts.setCurrentNav(this.docs.currNote);
          virtualclass.vutil.hideUploadMsg('docsuploadContainer'); // file uploader container
          virtualclass.vutil.addNoteClass();
        } else {
          this.removePagesUI(doc);
          if (!virtualclass.dts.noteExist()) {
            virtualclass.vutil.showUploadMsg('docsuploadContainer'); // file uploader container
            virtualclass.dts.docs.currNote = 0;
            virtualclass.dts.docs.currDoc = undefined;
            virtualclass.gObj.currWb = null;
            // virtualclass.dts.indexNav.removeNav();
          }

          if (!virtualclass.dts.docSelected()) {
            const docsObj = JSON.parse(localStorage.getItem('dtsdocs'));
            if (docsObj != null) {
              docsObj.slideNumber = null;
              // localStorage.setItem('dtsdocs', JSON.stringify(docsObj));
            }
            if (roles.isStudent()) {
              const cont = document.querySelector(`#cont${virtualclass.gObj.currWb}`);
              if (cont != null) {
                cont.style.display = 'block';
              } else {
                const docsContainer = document.querySelector('#docScreenContainer');
                if (docsContainer != null) {
                  docsContainer.classList.remove('noteDisplay');
                }
                virtualclass.gObj.currWb = null;

                const virtualclassCont = document.querySelector('#virtualclassCont');
                virtualclassCont.classList.remove('pdfRendering');

                // if(!Object.keys(virtualclass.dts.notes).length){
                //  if(!roles.hasControls()){
                const zoomHide = document.querySelector('#virtualclassAppLeftPanel.hideZoom');
                const zoom = document.querySelector('#virtualclassAppLeftPanel');
                if (!zoomHide) {
                  zoom.classList.add('hideZoom');
                  zoom.classList.remove('showZoom');
                }
                // }
                // }
              }
            }
          }
        }

        const currNavApp = document.querySelector('#listnotes .currentNav');
        if (currNavApp == null) {
          const firstNote = document.querySelector('#listnotes .linknotes');
          if (firstNote != null) {
            virtualclass.dts.currNote = firstNote.dataset.rid;
            const mainp = document.querySelector(`#mainpnotes${virtualclass.dts.currNote}`);
            // Clicking on default doc's navigation
            if (mainp != null) {
              // Getting the relative document according to note
              virtualclass.dts.docs.currDoc = virtualclass.dts.currNote.split('_')[0];
              mainp.click();
            }
          }
        }

        if (roles.hasAdmin()) {
          this.sendOrder(this.order);
        }
      },

      selectFirstNote() {
        const currenElement = document.querySelector('#notesContainer .current');
        if (currenElement == null) {
          const firstElement = document.querySelector('#notesContainer .note');
          if (firstElement != null) {
            this.docs.currNote = firstElement.dataset.slide;
            // console.log(`Current note ${this.docs.currNote}`);
            this.docs.currDoc = `docs${this.getDocId(firstElement.dataset.slide)}`;
            this.docs.note.getScreen(firstElement);
          }
        }
      },

      isDocumentExist(docsObj) {
        if (typeof docsObj !== 'undefined') {
          if (docsObj.init != 'layout' && docsObj.init != 'studentlayout') {
            return true;
          }
          return false;
        }
      },

      isDocAlreadyExist(id) {
        for (let i = 0; i < this.documents.length; i++) {
          if (this.documents[i].id == id) {
            return true;
          }
        }
        return false;
      },

      UI: {
        id: 'virtualclassDocumentShare',
        class: 'virtualclass container',

        /*
         * Creates container for the video and appends the container before audio widget
         */
        container() {
          const docShareCont = document.getElementById(this.id);
          if (docShareCont == null) {
            // const control = !!roles.hasAdmin();
            const data = { control: roles.hasControls() };

            const template = virtualclass.getTemplate('docsMain', 'documentSharing');
            // $('#virtualclassAppLeftPanel').append(template(data));

            // $('#virtualclassAppLeftPanel').append(template(data));

            virtualclass.vutil.insertAppLayout(template(data));


            if (document.querySelector('#congdashboard') == null) {
              // Creating Document Dashboard Container
              const dashboardTemp = virtualclass.getTemplate('dashboard');
              const dbHtml = dashboardTemp({ app: 'DocumentShare' });
              document.querySelector('#dashboardContainer').innerHTML = dbHtml;
            }
          }

          if (document.querySelector('#DocumentShareDashboard') == null) {
            const elem = document.createElement('div');
            const cont = document.querySelector('#congdashboard .modal-body');
            cont.appendChild(elem);
            elem.id = 'DocumentShareDashboard';
          }

          if (document.querySelector('#docsDbCont') == null) {
            // Creating  DOC's Dashboard
            document.querySelector('#DocumentShareDashboard').innerHTML = virtualclass.vutil.getDocsDashBoard('DocumentShare');
            if (roles.hasControls()) {
              virtualclass.vutil.attachEventToUploadTab();
              if (document.querySelector('#DocumentShareDashboard .qq-gallery') == null) {
                virtualclass.vutil.modalPopup('docs', ['docsuploadContainer']);
              }
              /** Initialize close handler of document's dailogue box, if it's not,
               *  then there is a problem when user click on document dashboard after page refreshing on whiteboard */
              virtualclass.vutil.modalCloseHandler();
            }
          }
        },

        createMainContent(container, content, docId) {
          // this.createSlides(container, content);
        },

        createSlides(pageContainer, allNotes) {
          let notes = document.querySelector('#notesContainer');
          if (notes == null) {
            notes = document.createElement('div');
            notes.className = 'notes';
            notes.id = 'notesContainer';
          }

          const cthis = virtualclass.dts;
          for (let i = 0; i < allNotes.length; i++) {
            const noteId = `note${allNotes[i].id}`;
            if (document.querySelector(`#note${allNotes[i].id}`) == null) {
              const note = document.createElement('div');
              note.id = `note${allNotes[i].id}`;
              note.className = 'note';
              note.dataset.slide = allNotes[i].id;

              if (note.dataset.statuS == 'true' || note.dataset.statuS == true) {
                note.dataset.status = 1;
              } else if (note.dataset.status == 'false' || note.dataset.status == false) {
                note.dataset.status = 0;
              } else {
                note.dataset.status = allNotes[i].status;
              }
            }
          }

          pageContainer.appendChild(notes);
          if (roles.hasControls()) {
            this.createNavigation(pageContainer, 'prev');
            this.createNavigation(pageContainer, 'next');
          }
        },

        createNavigation(pageContainer, cmd) {
          if (document.querySelector(`#docs${cmd}`) == null) {
            const nav = document.createElement('span');
            nav.className = `${'nvgt' + ' '}${cmd}`;
            nav.id = `docs${cmd}`;
            pageContainer.appendChild(nav);
          }
        },

        /**
         * Display leftbar navigation
         *
         */
        createDocsNav(elem, docId) {
          // Please put below comment into console to create dummy
          // var docScreenContainer = document.getElementById('docScreenContainer');
          // virtualclass.dts.UI.createDocsNav(docScreenContainer, 1);

          // var docScreenContainer = document.getElementById('docScreenContainer');
          // virtualclass.dts.UI.createDocsNav(docScreenContainer, 2);

          let docNav = document.getElementById('listDocs');
          if (docNav == null) {
            const cthis = virtualclass.dts;
            docNav = document.createElement('div');
            docNav.id = 'listDocs';
            elem.appendChild(docNav);
          }

          const linkNav = this.createDocsNavLink(docId);
          this.attachDocsNav(linkNav, docId);
          docNav.appendChild(linkNav);
        },

        createDocsNavLink(sn) {
          const link = document.createElement('div');
          link.id = `link${sn}`;
          link.className = 'linkdoc';
          link.innerHTML = sn;
          link.dataset.screen = sn;
          return link;
        },

        attachDocsNav(linkNav, docId) {
          const cthis = virtualclass.dts;
          linkNav.onclick = cthis.docs.goToDocs(docId);
        },
      },

      createNoteNav(fromReload) {
        if (this.order) {
          this.indexNav.init();
        }

        const curr = virtualclass.dts.docs.currNote;
        const order = '';
        for (let i = 0; i < this.order.length; i++) {
          if (typeof this.notes[this.order[i]] !== 'object') {
            if (this.allNotes[this.order[i]].status == 'true' || (+this.allNotes[this.order[i]].status) == 1) {
              var status = 1;
            } else {
              var status = 0;
            }
            this.notes[this.order[i]] = new virtualclass.page('screen-docs', 'notes', 'virtualclassDocumentShare', 'dts', status);
            this.notes[this.order[i]].init(this.order[i], `note_${this.allNotes[this.order[i]].lc_content_id}_${this.order[i]}`);
            if (typeof fromReload === 'undefined') {
              this.noteStatus(this.order[i], status);
            }
          }
          if (roles.hasControls()) {
            this.indexNav.createDocNavigationNumber(this.order[i], i, status);
          }
        }

        if (roles.hasControls()) {
          this.indexNav.shownPage(this.indexNav.width);
          this.indexNav.addActiveNavigation();
          const subCont = document.querySelector('#dcPaging');
          subCont.addEventListener('change', function () {
            virtualclass.dts.docs.goToNavs(this.value)();
          });
        }

        const btn = document.querySelector('.congrea.teacher  #dashboardContainer .modal-header button.enable');
        if (!btn) {
          virtualclass.vutil.showFinishBtn();
        }
        this.indexNav.setTotalPages(virtualclass.dts.order.length);

        //                var index = document.querySelector(".congrea #dcPaging #index" + curr);
        //                if (index && !index.classList.contains('active')) {
        //                    index.classList.add("active");
        //                }
      },

      addNoteHidClass(sn, i, n) {
        if (i > n) {
          sn.classList.add('hid', 'right');
        } else {
          sn.classList.add('shw');
        }
      },

      indexHandler(order) {
        // virtualclass.page.prototype.createPageNavAttachEvent(order)
        virtualclass.dts.docs.goToNavs(order);
      },

      createNoteNavAlt(fromReload) {
        // need to get all images from here
        for (let i = 0; i < this.order.length; i++) {
          if (this.allNotes[this.order[i]].status == 'true' || (+this.allNotes[this.order[i]].status) == 1) {
            var status = 1;
          } else {
            var status = 0;
          }
          this.notes[this.order[i]] = new virtualclass.page('screen-docs', 'notes', 'virtualclassDocumentShare', 'dts', status);
          this.notes[this.order[i]].init(this.order[i], `note_${this.allNotes[this.order[i]].lc_content_id}_${this.order[i]}`);
          if (typeof fromReload === 'undefined') {
            this.noteStatus(this.order[i], status);
          }
        }
      },

      removeNoteNav(note) {
        const linknote = document.querySelector(`#linknotes${note}`);
        if (linknote != null) {
          linknote.parentNode.removeChild(linknote);
        }

        if (typeof this.notes[note] === 'object') {
          delete this.notes[note];
        }
      },

      docs: {
        num: 0,
        currNote: 0,

        // Get the passed slide or first slide
        curr(sn, slide) {
          this.currDoc = sn;
          const cthis = virtualclass.dts;
          virtualclass.dts.docs.num = sn;

          const prev = document.querySelector('#documentScreen .screen.current');
          if (prev != null) {
            prev.classList.remove('current');
          }

          const screen = document.querySelector('#screen-docs');
          screen.classList.add('current');

          const docContainer = document.querySelector('#documentScreen');
          docContainer.dataset.screen = sn;

          if (typeof slide !== 'undefined') {
            this.note = new this.slide(slide);
          } else {
            this.note = new this.slide();
          }

          this.note.init();
          this.note.currentSlide(this.currNote);
        },

        display(selector) {
          document.querySelector(selector).style.display = 'block';
        },

        hide(selector) {
          document.querySelector(selector).style.display = 'none';
        },

        goToDocs(doc) {
          const cthis = this;
          return function () {
            if (typeof virtualclass.dts.docs.note === 'object') {
              virtualclass.vutil.updateCurrentDoc(virtualclass.dts.docs.note.currNote);
            }
            cthis.executeScreen(doc);
            if (roles.hasControls()) {
              if (Object.keys(virtualclass.dts.notes).length) {
                virtualclass.vutil.showFinishBtn();
              } else {
                virtualclass.vutil.removeFinishBtn();
              }
            }
          };
        },

        /**
         *
         * @param note expects the note which would be displayed into current view
         *
         */
        goToNavs(note) {
          const cthis = this;
          return function () {
            const element = document.querySelector(`#linknotes${note}`);
            if (element != null) {
              if ((+element.dataset.status) == 1) {
                virtualclass.dts.docs.currNote = note;
                virtualclass.dts.docs.note.currentSlide(note);
              }
            } else {
              virtualclass.dts.docs.currNote = note;
              virtualclass.dts.docs.note.currentSlide(note);
            }
            virtualclass.dts.indexNav.addActiveNavigation();
            virtualclass.dts.indexNav.UI.setClassPrevNext();
          };
        },

        studentExecuteScreen(data) {
          const filePath = data.dres;
          this.currDoc = filePath;
          const relativeDocs = virtualclass.dts.getDocs(filePath);
          if (relativeDocs != null) {
            virtualclass.dts.onResponseFiles(filePath, relativeDocs, data.ds);
          }
          // TODO, disabling following can be critical, with new api
          // virtualclass.vutil.updateCurrentDoc(this.currDoc, 1);
        },

        /**
         * If doc is already not exist, it does request to server
         * and create doc with whiteboard and slide
         *
         */

        executeScreen(doc, fromReload, cb, slide) {
          this.currDoc = doc;
          if (doc.indexOf('docs') == -1) {
            this.currDoc = `docs${doc}`; // In case of missing docs
          }

          const cthis = virtualclass.dts;
          if (roles.hasControls() && typeof fromReload === 'undefined') {
            const notes = cthis.requestSlides(doc);
            if (notes != null) {
              cthis.onResponseFiles(doc, notes);
              if (typeof cb !== 'undefined') {
                cb();
              }
            } else {
              // console.log('There is no data');
            }
          } else if (typeof slide !== undefined) {
            // this should be removed
            if (typeof doc === 'string' && doc.indexOf('docs') > -1) {
              doc = doc.split('docs')[1];
            }
            const slides = cthis.getDocs(doc);
            if (slides != null) {
              if (typeof fromReload === 'undefined') {
                cthis.onResponseFiles(doc, slides, undefined, slide);
              } else {
                cthis.onResponseFiles(doc, slides, undefined, slide, 'fromReload');
              }

              if (typeof cb !== 'undefined') {
                cb();
              }
            }
          }
        },

        displayScreen(screen, slide) {
          // console.log('==== prev display screen');
          if (typeof slide !== 'undefined') {
            this.curr(screen, slide);
          } else {
            this.curr(screen);
          }
        },


        /**
         * Create whitebaord/annoation tool for each slide/note
         * @param slide expects the slide
         */
        async createWhiteboard(slide) {
          const cthis = virtualclass.dts;
          const wbid = `_doc_${slide}_${slide}`;

          /**
           * This canvas width and height is set for Screen 1280 * 1024
           * The same dimension is using for image
           */

          /** * width and height handling ** */

          // var res = virtualclass.system.measureResoultion({'width': window.innerWidth, 'height': window.innerHeight});

          const canvasWidth = 730;
          const canvasHeight = 750;

          // cthis.setNoteDimension(canvasWidth, canvasHeight, wbid);
          // console.log('Create Whiteboard ');

          // console.log(`${virtualclass.gObj.currWb} ` + 'document share Create Whiteboard ');
          const whiteboard = document.createElement('div');
          whiteboard.id = 'cont';
          whiteboard.className = 'whiteboard';

          whiteboard.dataset.wid = wbid;
          whiteboard.id = `cont${whiteboard.dataset.wid}`;

          // document.querySelector("[data-doc='1'] .slide[data-slide='1']");

          const query = `.note[data-slide='${slide}']`;
          const elem = document.querySelector(query);
          if (elem != null) {
            elem.insertBefore(whiteboard, elem.firstChild);
            await virtualclass.vutil.createWhiteBoard(whiteboard.dataset.wid);
          } else {
            // console.log('Element is null');
          }
          // console.log('==== previous set ', virtualclass.dtsConfig.id);
          virtualclass.previous = virtualclass.dtsConfig.id;
        },

        /**
         *
         * @param thslide represents the slide/note
         *
         */
        slide: function slide(thslide) {
          return {
            li_items: 0,
            imageNumber: 0,
            currSlide: (typeof thslide !== 'undefined') ? thslide : 0, // TODO this should be removed
            currNote: (typeof thslide !== 'undefined') ? thslide : 0,
            doc: 1,
            init(screen) {
              const cthis = virtualclass.dts;
              var screen = '#screen-docs';

              const docScreen = document.querySelector(`${screen} .notes`);

              this.doc = cthis.docs.num;

              if (docScreen != null) {
                this.li_items = docScreen.children;
                this.imageNumber = this.li_items.length;

                if (roles.hasControls()) {
                  const prev = document.querySelector(`${screen} .prev`);
                  const next = document.querySelector(`${screen} .next`);
                  const dthis = this;

                  prev.onclick = function () {
                    virtualclass.vutil.navWhiteboard(dthis, dthis.prevSlide, cthis);
                  };

                  next.onclick = function () {
                    virtualclass.vutil.navWhiteboard(dthis, dthis.nextSlide, cthis);
                  };
                }
              } else {
                alert('no element');
              }
            },

            slideTo(note, fromReload) {
              const noteId = note.dataset.slide;
              virtualclass.vutil.updateCurrentDoc(noteId);

              this.displaySlide(note);

              /**
               * TODO, that setTimeout should be removed, it used to hanldle black screen at student
               * while teacher select/click the document tab subsequently
               * */
              if (roles.hasControls() && typeof fromReload === 'undefined') {
                // console.log('==== dts must send current thslide');
                ioAdapter.mustSend({
                  dts: { slideTo: noteId, docn: virtualclass.dts.docs.currDoc },
                  cf: 'dts',
                });
                // console.log(`Slide to document sharing ${noteId}`);
              }
            },

            /**
             * display the passed thslide/note
             * Expects the note that has to be display
             */
            displaySlide(note) {
              // TODO this should be used by cthis/this
              // const cthis = virtualclass.dts;
              // var currElem = document.querySelector('div[data-thslide="'+thslide+'"]');
              const prevElem = document.querySelector('#screen-docs .note.current');
              if (prevElem != null) {
                prevElem.classList.remove('current');
              }

              if (note != null) {
                note.classList.add('current');
              }
              virtualclass.vutil.addNoteClass();
              if (!roles.hasControls()) {
                const id = note.id.split('note')[1];
                virtualclass.dts.indexNav.studentDocNavigation(id);
              }
            },

            /**
             * display the previous thslide/note
             * cthis expects main class virtuaclass.dts
             */
            prevSlide(cthis) {
              const currNodeId = cthis.docs.currNote;
              const currElem = document.querySelector(`#documentScreen #note${currNodeId}`);
              if (currElem != null) {
                const prevSlide = currElem.previousElementSibling;
                if (prevSlide != null) {
                  if ((+prevSlide.dataset.status) == 0) {
                    const activeSlide = this.getActiveSlide(cthis, currNodeId, 'prev');
                    if (!activeSlide) {
                      // alert('There is no page');
                      // virtualclass.dts.indexNav.UI.setArrowStatus('leftNavPage', 'disable');

                      virtualclass.dts.indexNav.UI._setArrowStatusDocs(document.getElementById('leftNavPage'), 'disable', 'enable');
                    } else {
                      // by true, know the event is performed real user
                      this.getScreen(activeSlide, true);
                      cthis.docs.currNote = activeSlide.dataset.slide;
                      // console.log(`Current note ${virtualclass.dts.docs.currNote}`);
                    }
                  } else {
                    this.getScreen(prevSlide, true);
                    cthis.docs.currNote = prevSlide.dataset.slide;
                    // console.log(`Current note ${virtualclass.dts.docs.currNote}`);
                  }

                  /** to set the dimension of whiteboard during window is resized * */
                  const currWb = virtualclass.wb[`_doc_${cthis.docs.currNote}_${cthis.docs.currNote}`];
                  if (typeof currWb === 'object') {
                    system.setAppDimension(null, 'resize');
                  }

                  virtualclass.dts.indexNav.movePageIndex('left');
                } else {
                  virtualclass.dts.indexNav.UI._setArrowStatusDocs(document.getElementById('leftNavPage'), 'disable', 'enable');
                }
              }
            },

            getActiveSlide(cthis, id, which) {
              const currElem = document.querySelector(`#documentScreen #note${id}`);
              if (currElem != null) {
                if (which == 'next') {
                  var activeSlide = currElem.nextElementSibling;
                } else {
                  var activeSlide = currElem.previousElementSibling;
                }

                if (activeSlide != null) {
                  if ((+activeSlide.dataset.status) == 0) {
                    // return is need for return the end value
                    return this.getActiveSlide(cthis, activeSlide.dataset.slide, which);
                  }
                  return activeSlide;
                }
                return false;
              }
            },

            /**
             * display the next thslide/note
             * cthis expects main class virtuaclass.dts
             */
            nextSlide(cthis) {
              const lastElement = cthis.order[cthis.order.length - 1];
              const currNodeId = cthis.docs.currNote;

              if (currNodeId != lastElement) {
                const currElem = document.querySelector(`#documentScreen #note${currNodeId}`);
                if (currElem != null) {
                  const nextSlide = currElem.nextElementSibling;
                  if (nextSlide != null) {
                    if ((+nextSlide.dataset.status) == 0) {
                      const activeSlide = this.getActiveSlide(cthis, currNodeId, 'next');
                      if (!activeSlide) {
                        alert('There is no page');
                      } else {
                        this.getScreen(activeSlide, true);
                        cthis.docs.currNote = activeSlide.dataset.slide;
                        // console.log(`Current note ${virtualclass.dts.docs.currNote}`);
                      }
                    } else {
                      this.getScreen(nextSlide, true);
                      cthis.docs.currNote = nextSlide.dataset.slide;
                    }
                  }
                }
                virtualclass.dts.indexNav.movePageIndex('right');
              } else {
                // alert('There is no page');
                virtualclass.dts.indexNav.UI._setArrowStatusDocs(document.getElementById('rightNavPage'), 'disable', 'enable');
                virtualclass.zoom.adjustScreenOnDifferentPdfWidth();
              }
            },

            isSlideAvailable(slidId, lastElement) {
              if (slidId == lastElement) {
                return false;
              }
              return true;
            },

            /**
             * display the current thslide/note
             * slideNum exepects the thslide
             */
            currentSlide(slideNum) {
              const currElem = document.querySelector(`#documentScreen #note${slideNum}`);
              if (currElem != null) {
                // console.log(`${slideNum} ` + ' ====> init trigger');
                this.getScreen(currElem);
              } else {
                // console.log(`Document-Sharing:-${slideNum} is not found `);
              }
              const docsContainer = document.querySelector('#docScreenContainer');
              if (docsContainer != null) {
                docsContainer.classList.add('noteDisplay');
              }
            },

            isPdfRendered() {
              const pdfRenderElem = document.querySelector(`#canvas${virtualclass.gObj.currWb}`);
              if (pdfRenderElem != null) {
                return Object.prototype.hasOwnProperty.call(pdfRenderElem.parentNode.dataset, 'pdfrender');
              }
              return false;
            },

            /**
             * Create the screen with Whiteboard and Current thslide
             */
            getScreen(note, userClicked) {
              // if(typeof virtualclass.gObj.currWb != 'undefined' && virtualclass.gObj.currWb != null){
              //   if(note.nextElementSibling != null){
              //      var preFetchSlide =  note.nextElementSibling.dataset.thslide;
              //      virtualclass.pdfRender[virtualclass.gObj.currWb].prefechPdf(preFetchSlide);
              //     }
              // }

              this.currSlide = note.dataset.slide;
              this.currNote = note.dataset.slide;
              virtualclass.dts.currDoc = this.doc;

              this.slideTo(note);

              // todo, critical that's need to be enable and handle properly
              // if (virtualclass.wb[virtualclass.gObj.currWb] != null) {
              //   console.log(`whiteboard ============ ${virtualclass.wb[virtualclass.gObj.currWb].gObj.queue.length}`);
              // }

              //
              // if (virtualclass.wb[virtualclass.gObj.currWb] != null && virtualclass.wb[virtualclass.gObj.currWb].gObj.queue.length > 0) {
              //   virtualclass.gObj.tempQueue[virtualclass.gObj.currWb] = virtualclass.wb[virtualclass.gObj.currWb].gObj.queue;
              // }

              if (!this.isWhiteboardExist(this.currNote)) {
                virtualclass.dts.docs.createWhiteboard(this.currNote);
              } else if (this.isWhiteboardExist(this.currNote) && !this.isPdfRendered(this.currNote)) {
                // console.log('Delete whiteboard');
                delete virtualclass.wb[virtualclass.gObj.currWb];
                virtualclass.dts.docs.createWhiteboard(this.currNote);
              } else {
                // If there is a zoom, that needs to apply at in next/previous screen,
                // virtualclass.zoom.normalRender();
                virtualclass.zoom.adjustScreenOnDifferentPdfWidth();

                // virtualclass.zoom.zoomAction('fitToScreen');
              }

              virtualclass.vutil.updateCurrentDoc(this.currNote);
              virtualclass.dts.updateLinkNotes(this.currNote);

              const isFirstNote = virtualclass.dts.isFirstNote(note.id);
              const isLastNote = virtualclass.dts.isLastNote(note.id);

              const notesContainer = document.querySelector('#screen-docs .pageContainer');

              if (isFirstNote && isLastNote) {
                notesContainer.classList.add('firstNote');
                notesContainer.classList.add('lastNote');
              } else if (isFirstNote) {
                notesContainer.classList.remove('lastNote');
                notesContainer.classList.add('firstNote');
              } else if (isLastNote) {
                notesContainer.classList.remove('firstNote');
                notesContainer.classList.add('lastNote');
              } else {
                notesContainer.classList.remove('firstNote');
                notesContainer.classList.remove('lastNote');
              }
            },
            /**
             * this expects the the whiteboard related to thslide
             * is exist or not
             * @param thslide expects thslide/note
             * @returns {boolean}
             */
            isWhiteboardExist(slide) {
              const wbContId = `containerWb_doc_${slide}_${slide}`;
              const wbCont = document.querySelector(`#${wbContId}`);
              return (wbCont != null);
            },
          };
        },
      },

      /**
       * Destryo the dts class
       */
      destroyDts() {
        const appWrapper = document.getElementById(virtualclass.dts.UI.id);
        if (appWrapper != null) {
          appWrapper.parentNode.removeChild(appWrapper);
        } else {
          // console.log('Element is null');
        }
        virtualclass.dts = null;
      },

      screenIsCreated(doc) {
        const screen = document.getElementById(`screen${doc}`);
        return (screen != null);
      },

      convertInObjects(allPages) {
        const note = {};
        for (let i = 0; i < allPages.length; i++) {
          note[allPages[i].fileuuid] = allPages[i];
        }
        return note;
      },


      /**
       * This onmessage performs when
       * the messsage/packet related to document sharing
       * is received
       * @param e expects event
       */
      onmessage(e) {
        if (typeof virtualclass.dts !== 'object') {
          virtualclass.makeAppReady('DocumentShare', undefined, { init: 'studentlayout' });
        }
        const { dts } = e.message;
        if (Object.prototype.hasOwnProperty.call(dts, 'docn') && dts.docn.indexOf('docs') == -1) {
          dts.docn = `docs${dts.docn}`; // incaseof missing docs prefix
        }

        if (Object.prototype.hasOwnProperty.call(dts, 'fallDocs')) {
          virtualclass.dts.afterFirstRequestDocs(virtualclass.serverData.rawData.docs);
        } else if (Object.prototype.hasOwnProperty.call(dts, 'dres')) {
          this.docs.studentExecuteScreen(dts);
          // console.log(`${virtualclass.gObj.currWb} ` + 'document share :- Layout initialized');
        } else if (Object.prototype.hasOwnProperty.call(dts, 'slideTo')) {
          if (typeof this.docs.note !== 'object') {
            const cthis = this;
            this.docs.executeScreen(dts.docn, undefined, () => {
              // console.log('document share :- doc is not created');
              cthis.docs.note.currNote = dts.slideTo;
              const note = document.querySelector(`#note${dts.slideTo}`);
              cthis.docs.note.slideTo(note);
            }, dts.slideTo);

            // if teacher refresh the page and navigat to other doc
            // In student window, It will execute below else condition, it trigger for next slide
            // In this case the docs are different so we need to initalize first
            // doc and after that we need to call for next slide
          } else if (typeof this.docs.note === 'object' && dts.docn != this.docs.num) {
            this.docs.currNote = dts.slideTo;
            // console.log(`Current note ${this.docs.currNote}`);
            this.docs.executeScreen(dts.docn, undefined);
            this.docs.note.currentSlide(dts.slideTo);
          } else {
            const note = document.querySelector(`#note${dts.slideTo}`);
            if (note != null) {
              this.docs.currNote = dts.slideTo;
              // console.log(`Current note ${this.docs.currNote}`);
              // In normal case
              // console.log(`${virtualclass.gObj.currWb} ` + ' ====> init trigger');
              this.docs.note.getScreen(note);
              // console.log(`${virtualclass.gObj.currWb} ` + 'document share :- Normal Case');
            } else {
              alert(`Note is not found ${dts.slideTo}`);
            }
          }
        } else if (Object.prototype.hasOwnProperty.call(dts, 'dispScreen')) {
          const doc = dts.dispScreen.sc;
          virtualclass.vutil.updateCurrentDoc(doc, dts.dispScreen.sn);
          if (!virtualclass.dts.screenIsCreated(doc)) {
            // console.log('document share :- With screen Created');
            // console.log(`${virtualclass.gObj.currWb} ` + 'document share :- With screen Created');
            this.docs.executeScreen(doc, undefined, undefined, dts.dispScreen.sn);
            if (typeof this.docs.note === 'object') {
              this.docs.note.getScreen(dts.dispScreen.sn); // it will get the screen if there is not already
            }
          } else {
            // console.log('document share :- Only display screen');
            // console.log(`${virtualclass.gObj.currWb} ` + 'document share :- Only display screen');
            this.docs.displayScreen(doc);
          }
        } else if (Object.prototype.hasOwnProperty.call(dts, 'rmnote')) {
          this._delete(dts.rmnote);
        } else if (Object.prototype.hasOwnProperty.call(dts, 'rmsnote')) { // remove single note
          this._removePageUI(dts.rmsnote);
          this._removePageFromStructure(dts.rmsnote);
        } else if (Object.prototype.hasOwnProperty.call(dts, 'noteSt')) {
          this.noteStatus(dts.note, dts.noteSt);
        } else if (Object.prototype.hasOwnProperty.call(dts, 'docSt')) {
          this.docStatus(dts.doc, dts.docSt);
        } else if (Object.prototype.hasOwnProperty.call(dts, 'order_recived')) {
          this.afterRequestOrder(dts.order_recived);
        } else if (Object.prototype.hasOwnProperty.call(dts, 'norder')) {
          this.order = dts.norder;
          virtualclass.dts.indexNav.studentDocNavigation(this.docs.currNote);
        }
      },

      sendCurrentSlide() {
        if (Object.prototype.hasOwnProperty.call(virtualclass.dts.docs, 'currDoc')) {
          const doc = virtualclass.dts.docs.currDoc;
          if (doc != undefined) {
            if (document.querySelector('#listnotes .note') != null) {
              // console.log('==== dts must send ');
              ioAdapter.mustSend({
                dts: { slideTo: virtualclass.dts.docs.note.currNote, docn: doc },
                cf: 'dts',
              });
              // console.log(`${virtualclass.gObj.currWb} ` + 'Document share send current slide');
            }
          } else {
            // console.log('Document sharing : doc number is undefined');
          }
        }
      },

      sendCurrentDoc() {
        if (Object.prototype.hasOwnProperty.call(virtualclass.dts.docs, 'currDoc')) {
          if (doc != undefined) {
            var doc = virtualclass.dts.docs.currDoc;
            // console.log('==== dts must send ');
            ioAdapter.mustSend({ dts: { doc: doc = virtualclass.dts.docs.currDoc }, cf: 'dts' });
            // console.log('Document share send current doc only');
            // console.log(`${virtualclass.gObj.currWb} ` + 'Document share send current doc only');
          } else {
            // console.log('Document sharing : doc number is undefined');
          }
        }
      },

      consoleMessage(msg) {
        // console.log(`${virtualclass.gObj.currWb} ${msg}`);
      },

      _rearrange(pageOrder) {
        alert(pageOrder.toString());
      },

      reArrangeNotes(order) {
        this.order = order;
        this.reArrangeElements(order);
        if (roles.hasAdmin()) {
          this.sendOrder(this.order);
          // console.log('==== dts must send norder');
          ioAdapter.mustSend({ dts: { norder: this.order }, cf: 'dts' });
        }
      },

      sendOrder(order) {
        virtualclass.vutil.sendOrder('docs', order);
      },

      reaArrangeThumbCount() {
        const allThumbist = document.querySelectorAll('#listnotes .thumbList');
        for (let j = 0; j < allThumbist.length; j++) {
          allThumbist[j].innerHTML = j + 1;
        }
      },
      reArrangeElements(order) {
        const container = document.getElementById('notesContainer');
        const tmpdiv = document.createElement('div');
        tmpdiv.id = 'notesContainer';
        tmpdiv.className = 'notes';

        /**
         * TODO, This should be improved, we don't need to call getActiveNotes each  time when we need active notes,
         * it should be invoked only once,
         * It handles, if there are videoswhich are not in orders, that videos should be display also
         * */

        for (let i = 0; i < order.length; i++) {
          tmpdiv.appendChild(document.getElementById(`note${order[i]}`));
        }
        container.parentNode.replaceChild(tmpdiv, container);


        // organize list
        this.reaArrangeThumbCount();
        const paging = document.querySelectorAll('#dcPaging .noteIndex');
        if (paging.length > 0) {
          this.indexNav.rearrangePageNavigation(order);// new
        }
        const subCont = document.querySelector('#dcPaging');
        subCont.addEventListener('change', function () {
          virtualclass.dts.docs.goToNavs(this.value)();
        });
      },

      _delete(id) {
        const linkDocs = document.querySelector(`#linkdocs${id}`);
        if (linkDocs != null) {
          linkDocs.parentNode.removeChild(linkDocs);
        }
        const data = {
          uuid: id,
          action: 'delete',
          page: 0,
        };

        const url = virtualclass.api.UpdateDocumentStatus;
        const that = this;

        const cthis = this;
        virtualclass.xhrn.vxhrn.post(url, data).then((res) => {
          if (res.data.status == 'ok') {
            cthis.sendOrder(cthis.order);
          }
        });

        delete this.pages[`docs${id}`];
        this.removePagesUI(id);
        this.removePagesFromStructure(id);
      },

      _deleteNote(id, typeDoc) {
        this._removePageUI(id, typeDoc);
        this._removePageFromStructure(id, typeDoc);
        if (roles.hasControls()) {
          // console.log('==== dts must send ');
          ioAdapter.mustSend({ dts: { rmsnote: id }, cf: 'dts' });
        }

        const idarr = id.split('_');
        const doc = idarr[0];
        const pid = parseInt(idarr[1]);

        const data = {
          uuid: doc,
          action: 'delete',
          page: pid,
        };

        const url = virtualclass.api.UpdateDocumentStatus;

        const cthis = this;
        virtualclass.xhrn.vxhrn.post(url, data).then((res) => {
          if (res.data.status == 'ok') {
            cthis.sendOrder(cthis.order);
          }
        });

        // Check if there is exist any noted
        let noteExit = false;
        const mainDoc = virtualclass.dts.allDocs[doc];
        if (mainDoc != null) {
          for (let i = 0; i < mainDoc.notesarr.length; i++) {
            if (!Object.prototype.hasOwnProperty.call(mainDoc.notesarr[i], 'deletedn')) {
              noteExit = true;
              break;
            }
          }
        }
        if (!noteExit) {
          this._delete(doc);
        }
        if (roles.hasControls()) {
          this.indexNav.createIndex();
        }
      },

      removePagesFromStructure(id) {
        this.allDocs[id].deleted = '0';
        const result = [];
        let i;
        for (i in this.allNotes) {
          if (this.allNotes[i].id.indexOf(id) > -1) {
            this._removePageFromStructure(this.allNotes[i].id);
          }
        }
      },

      updateInAllDocs(noteid) {
        // var docId = virtualclass.dts.currDoc.substring(4, virtualclass.dts.currDoc.length);
        const docId = noteid.split('_')[0];
        const doc = this.allDocs[docId];
        if (typeof doc.notes[noteid] !== 'undefined') {
          doc.notes[noteid].deletedn = noteid;
          for (let i = 0; i < doc.notesarr.length; i++) {
            if (doc.notesarr[i].id == noteid) {
              doc.notesarr[i].deletedn = noteid;
            }
          }
        } else {
          // console.log(`The note with the id ${noteid} is not available`);
        }
      },

      _removePageFromStructure(id) {
        this.removeWhiteboardFromStorage(`_doc_${id}_${id}`);
        // delete this.allNotes[id];
        this.allNotes[id].deletedn = id;
        // new pages save into docs
        this.updateInAllDocs(id);
      },

      _disable(id) {
        this.docStatus(id);
      },

      _enable(id) {
        this.docStatus(id);
      },

      /** TODO, check if following function is using * */

      docStatus(id, status) {
        const note = document.querySelector(`#linkdocs${id} .controls.status`);
        if (note != null) {
          if (typeof status === 'undefined') {
            var status = (1 - (+note.dataset.status));
          } else {
            var status = status;
          }
        } else {
          // console.log(`document share:- there is no element ${id}`);
        }

        const allNotes = this.getDocs(id);
        for (let i = 0; i < allNotes.length; i++) {
          const nid = allNotes[i].id;
          this.noteStatus(nid, status);
          this.updatePageNavStatus(nid, status);
        }
        if (roles.hasControls()) {
          // console.log('==== dts must send ');
          ioAdapter.mustSend({ dts: { docSt: status, doc: id }, cf: 'dts' });
        }
      },

      /**
       * TODO, need to improve this funciton
       * related to event.status in page.js
       * around 360
       */
      updatePageNavStatus(id, status) {
        const linknote = document.querySelector(`#linknotes${id}`);
        if (linknote != null) {
          linknote.dataset.status = status;
          const childNode = linknote.querySelector('.controls.status');
          childNode.dataset.status = status;
          childNode.querySelector('.statusanch').innerHTML = `status${status}`;
        } else {
          // console.log(`${'Document share : there is no element ' + '#linknotes'}${id}`);
        }
      },


      _noteDisable(id) {
        this.noteStatus(id);
        this.sendNoteStatus(id);
      },

      _noteEnable(id) {
        this.noteStatus(id);
        this.sendNoteStatus(id);
      },

      sendNoteStatus(id) {
        if (roles.hasControls()) {
          const note = document.querySelector(`#note${id}`);
          if (note != null) {
            // console.log('==== dts must send ');
            ioAdapter.mustSend({ dts: { noteSt: note.dataset.status, note: id }, cf: 'dts' });
          } else {
            // console.log('Element is null');
          }
        }
      },

      /**
       * set the note status, like enable or disable
       * @param id expects note id
       * @param status expect enable or disable
       */
      noteStatus(id, status) {
        const note = document.querySelector(`#note${id}`);
        if (note != null) {
          if (typeof status === 'undefined') {
            var status = (1 - (+note.dataset.status));
          } else if (status == true || status == 'true') {
            status = 1;
          } else {
            status = 0;
          }
          note.dataset.status = status;
          const noteObj = this.allNotes[id];
          noteObj.status = note.dataset.status;
          this.allNotes[id] = noteObj;
        } else {
          // console.log(`there is no element #note${id}`);
        }
      },

      /**
       * get docs from inline variable
       *   @returns {Array}
       */
      getDocsOld(id) {
        const result = [];
        for (const i in this.allNotes) {
          if (id == this.allNotes[i].lc_content_id) {
            result.push(this.allNotes[i]);
          }
        }
        return result;
      },

      // Return the pages from specific page
      getDocs(id) {
        // console.log('--------------');
        if (this.allDocs != null && typeof this.allDocs[id] === 'object') {
          return this.allDocs[id].notesarr;
        }
        // console.log(`There is no document with the id ${id}`);
      },

      /**
       * get documenation id from all notes by using note id
       * @param id expectes node
       * @returns {*}
       */
      getDocId(id) {
        return id.split('_')[0];
      },

      getAllNotes(order) {
        const result = [];
        for (let i = 0; i < order.length; i++) {
          result.push(this.allNotes[order[i]]);
        }
        return result;
      },

      /**
       * get note object by passing note
       * @param id expects note
       * @returns {note}
       */
      getNote(id) {
        return this.allNotes[id];
      },

      updateLinkNotes(id) {
        const listnotes = document.querySelector('#listnotes .currentNav');
        if (listnotes != null) {
          listnotes.classList.remove('currentNav');
        }
        this.setCurrentNav(id);
      },

      setCurrentNav(id) {
        const linknotes = document.querySelector(`#linknotes${id}`);
        if (linknotes != null) {
          linknotes.classList.add('currentNav');
        }
      },

      /**
       * This function perform after upload the documenttion
       * @param id expects the upload file id,
       * @param xhr expects xhr object
       * @param response expects xhr response
       */
      onAjaxResponse(id, xhr, response) {
        if (Object.prototype.hasOwnProperty.call(response, 'success') && response.success) {
          for (let i = 0; i < virtualclass.gObj.uploadingFiles.length; i++) {
            const docUploadId = virtualclass.gObj.uploadingFiles[i].uuid;
            this.afterUploadFile(docUploadId);
          }

          virtualclass.gObj.uploadingFiles = [];
          this.showUploadMsz(virtualclass.lang.getString('docUploadSuccess'), 'alert-success');
        } else if (response.message === 'duplicate') {
          // alert(virtualclass.lang.getString('duplicateUploadMsg'));
          this.showUploadMsz(virtualclass.lang.getString('duplicateUploadMsg'), 'alert-error');
        } else if (Object.prototype.hasOwnProperty.call(response, 'error')) {
          this.showUploadMsz(response.error, 'alert-error');
        } else {
          this.showUploadMsz(virtualclass.lang.getString('someproblem'), 'alert-error');
        }

        const msz = document.querySelector('#DocumentShareDashboard .qq-upload-list-selector.qq-upload-list');
        if (msz) {
          msz.style.display = 'none';
        }

        const listnotes = document.querySelector('#listnotes');
        if (listnotes != null) {
          virtualclass.vutil.makeElementDeactive('#DocumentShareDashboard .qq-uploader-selector.qq-uploader.qq-gallery');
          virtualclass.vutil.makeElementActive('#listnotes');
        } else {
          // console.log('List note is null');
        }
      },

      showUploadMsz(msg, type) {
        const mszCont = document.querySelector('#DocumentShareDashboard #docsUploadMsz');

        const alertMsz = document.querySelector('#DocumentShareDashboard #docsUploadMsz .alert');
        if (alertMsz) {
          alertMsz.parentNode.removeChild(alertMsz);
        }
        const elem = document.createElement('div');
        elem.className = 'alert  alert-dismissable';
        elem.classList.add(type);
        elem.innerHTML = msg;
        mszCont.appendChild(elem);

        const btn = document.createElement('button');
        btn.className = 'close';
        btn.setAttribute('data-dismiss', 'alert');
        btn.innerHTML = '&times';
        elem.appendChild(btn);
        btn.addEventListener('click', function () {
          this.parentNode.remove();
        });
      },


      /**
       * Set width and height for note
       */
      setNoteDimension(width, height, nid) {
        const contElem = document.querySelector(`#cont${nid}`);
        if (contElem != null) {
          const noteContainer = contElem.parentNode;
          const noteId = noteContainer.id;
          const imageContainer = document.querySelector(`#${noteId} .imageContainer img`);
          imageContainer.style.width = width;
          imageContainer.style.height = height;
        }
        system.setDocCanvasDimension(width, height, nid);

        const notesContainer = document.querySelector('#screen-docs .pageContainer');
        if (roles.hasAdmin()) {
          // 60 for whiteboard height toolbar
          height += 60;
        }
        // for note's container height
        if (notesContainer != null) {
          notesContainer.style.width = `${width}px`;
          notesContainer.style.height = `${height}px`;
        }
      },

      isFirstNote(id) {
        const firstNote = document.querySelector('#notesContainer .note');
        return (firstNote != null && (id == firstNote.id));
      },

      isLastNote(id) {
        const allNotes = document.querySelectorAll('#notesContainer .note');
        const lastNote = allNotes[allNotes.length - 1];
        return (allNotes.length > 0 && (lastNote.id == id));
      },

      noteExist() {
        return (document.querySelector('#notesContainer .note') != null);
      },

      docSelected() {
        return document.querySelector('#listdocs .linkdocs[data-selected="1"]');
      },

      isUploaderExist() {
        const uploadElem = document.querySelector('#docsuploadContainer .qq-uploader-selector');
        return (uploadElem != null);
      },

    };
  };
  window.documentShare = documentShare;
}(window));
