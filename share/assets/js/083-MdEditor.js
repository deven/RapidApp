
Ext.ux.RapidApp.MdEditor = Ext.extend(Ext.form.Field,{

// ---------------------------------------------------------------------------------------
iframeHtml: '<html>  \
<head>  \
  <link rel="stylesheet" href="_ra-rel-mnt_/assets/rapidapp/misc/static/simplemde/normalize.css" />  \
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans:400,700" />  \
  <link rel="stylesheet" href="_ra-rel-mnt_/assets/rapidapp/misc/static/simplemde/stylesheet.css" />  \
  <link rel="stylesheet" href="_ra-rel-mnt_/assets/rapidapp/misc/static/simplemde/github-light.css" />  \
  <link rel="stylesheet" href="_ra-rel-mnt_/assets/rapidapp/misc/static/simplemde/fonts/font-awesome.min.css" />  \
  <link rel="stylesheet" href="_ra-rel-mnt_/assets/rapidapp/misc/static/simplemde/simplemde.min.css" />  \
  <script src="_ra-rel-mnt_/assets/rapidapp/misc/static/simplemde/simplemde.min.js"></script>  \
  <script src="_ra-rel-mnt_/assets/rapidapp/misc/static/simplemde/picoModal.js"></script>  \
  <style>  \
    .CodeMirror { padding: 0px; }  \
    ' + 
    // the min-height here must agree with the iframe in order for things to display properly
    '.CodeMirror, .CodeMirror-scroll { min-height: 150px; }  \
    ' + 
    // here we are making the editor *not* transparent so that in contexts where it might be 
    // rendered on top of other content (such as in a grid) it doesn"t show through in the 
    // toolbar. Then we"re also disabling rounded corners because the white shows through and 
    // is ugly  
    'body           { background-color: white; }  \
    .editor-toolbar { border-top-left-radius: 0;    border-top-right-radius: 0; }  \
    .CodeMirror     { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }  \
    '+ 
    // disable display of the icon used for fullscreen - fullscreen doesn"t work, but is needed
    // by "side-by-side". This is hacky, but is the cleanest solution at this point
    '.editor-toolbar a.fa-arrows-alt { display: none; }  \
    .editor-toolbar .toolbar-text { \
      font-size:11px; line-height:10px; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; \
      display: inline-block; vertical-align:middle; margin-bottom:7px; margin-left:5px; \
    }\
    '+ 
    // This is mainly for the "preview" but it doesn"t really ever make sense at this point 
    // to ever allow images to render wider than the display area 
    'img { max-width: 100%; }  \
  </style>  \
</head>  \
<body style="margin:0px;">  \
  <textarea   \
    id="ta-target"   \
    style="position:absolute; top:0; bottom:0; ;width:100%;border:0;"  \
  ></textarea>  \
  <script>  \
    window.document.simplemde = new SimpleMDE({  \
      picoModal: picoModal,  \
      customUploadActionFn: function(){   \
        throw " !! virtual method customUploadActionFn was not set to a real function!";   \
      },  \
      element: document.getElementById("ta-target"),  \
      forceSync: true,  \
      spellChecker: false,  \
      status: false,  \
      toolbar: [    \
        "bold", "italic", "strikethrough", "heading", "|",  \
        "quote", "unordered-list", "ordered-list", "|",  \
        "table", "code", "preview",  \
        ' +  
        // fullscreen is listed but its display is disabled in css above. fullscreen is needed 
        // for side-by-side to work properly (seems to be a simplemde bug)
        '"side-by-side", "fullscreen",  \
        "|", "link", "image",  \
        "|", {  \
          name: "upload",  \
          action: function customFunction(editor){  \
            return editor.options.customUploadActionFn(editor);  \
          },  \
          className: "fa fa-cloud-upload",  \
          title: "Insert Image/File",  \
        }  \
      ]  \
  \
    });  \
  </script>  \
</body>  \
</html> \
',

// ---------------------------------------------------------------------------------------


  initComponent: function() {
    this.on('afterrender',this.injectIframe,this);
    this.on('destroy',this.tearDown,this);
    
    if(!this._noAutoHeight) {
      // Currently the only way this field editor can work well for default/random scenarios
      // is to not be managed by ExtJS for dynamic size. This means that the only way for dynamic 
      // sizing to work is via native browser sizing of the div, such as using absolute positioning, 
      // which can be done within an AppDV. Within a grid/form, the size will be stuck at the 
      // min-height and min-width set on the iframe below. But, we do provide a special override
      // config option '_noAutoHeight' to bypass (this API is expected to change)
      this.autoHeight = true;
      this.autoWidth  = true;
    }
    
    this.autoCreate = { tag: 'div' };
    
    Ext.ux.RapidApp.iframeTextField.superclass.initComponent.call(this);
  },
  
  injectIframe: function() {
    if(!this.iframeDom) { 
    
      var iframe = document.createElement('iframe');
      iframe.frameborder = '0';
      iframe.src = 'about:blank';
      
      iframe.style['border']   = '0px';
      iframe.style['width']    = '100%';
      iframe.style['height']   = '100%';
      iframe.style['min-height'] = '200px';
      iframe.style['min-width'] = '500px'; // this is about as small as it can be w/o toolbar wrap

      this.el.dom.appendChild(iframe);
      
      iframe.contentWindow.document.open('text/html', 'replace');
      iframe.contentWindow.document.write(this.iframeHtml);
      iframe.contentWindow.document.close();
      
      this.iframeDom = iframe;
    }
  },
  
  getSimpleMDE: function() {
    if(!this.simplemde) {
      if(!this.iframeDom) { return null; }
      var simplemde = this.iframeDom.contentWindow.document.simplemde;
      if(!simplemde) { return null; }
      
      var scope = this;
      var iframe = this.iframeDom;
      
      var syncHeight = function() {
        var editorToolbarHeight = 49;
        simplemde.codemirror.setSize(null,iframe.clientHeight - editorToolbarHeight);
      }
      
      syncHeight();
      iframe.contentWindow.document.body.onresize = syncHeight;
      
      simplemde.options.customUploadActionFn = function() {
        return scope.customUploadActionFn.apply(scope,arguments);
      }
      
      var cm = simplemde.codemirror;
      cm.setOption('lineNumbers',true);
      
      cm.on('drop',function(cm,e) {
        // If this drop event is an file:
        //  (note: there is a bug in dumping this object in firebug, shows empty but isn't)
        var File = e.dataTransfer.files[0];
        if(!File) { return; }
        
        // prevent the browser/codemirror from any further processing:
        e.preventDefault();
        e.stopPropagation();
        
        scope.doXhrCasUpload(File);
      });

      this.simplemde = simplemde;
      
      this.mungeEditorToolbar();
    }
    return this.simplemde;
  },
  
  mungeEditorToolbar: function() {
    var simplemde = this.simplemde;
    var tbEl = this.simplemde.gui.toolbar;
    
    var textify = function(el,text) {
      el.style['width'] = 'auto';
      el.style['padding-left'] = '5px';
      el.style['padding-right'] = '5px';
      el.innerHTML = '<span class="toolbar-text">'+text+'</span>';
    }
    
    var upldEl =  tbEl.getElementsByClassName('fa-cloud-upload')[0];
    if(upldEl) {
      textify(upldEl,'insert file / image<br>[or drag &amp; drop]');
    }
    
    var sbsEl =  tbEl.getElementsByClassName('fa-columns')[0];
    if(sbsEl) {
      textify(sbsEl,'side-by-side<br>preview');
    }
  },
  
  setRawValue : function(v){
    return this.rendered ? (this.setTextAreaText(null,(Ext.isEmpty(v) ? '' : v))) : '';
  },

  setValue : function(v){
    this.value = v;
    if(this.rendered){
        this.setTextAreaText('set',Ext.isEmpty(v) ? '' : v);
    }
    return this;
  },

  setTextAreaText: function(opt,v,count) {
    count = count || 1;
    if(count> 100) { return; }
    
    var simplemde = this.getSimpleMDE();
    if(simplemde) {
      simplemde.value(v);
      if(opt == 'set') {
        this.value = v;
        this.validate();
      }
    }
    else {
      this.setTextAreaText.defer(10,this,[opt,v,count+1]);
    }
  },
  
  syncValue: function() {
    var simplemde = this.getSimpleMDE();
    if(simplemde) {
      this.value = simplemde.value();
    }
  },
  
  getRawValue: function() {
    this.syncValue();
    return this.value;
  },
  
  getValue : function(){
    return this.getRawValue();
  },
  
  doXhrCasUpload: function(File, addlCallback) {
    var scope = this;
    var editor = this.getSimpleMDE();
    var picoModal = editor.options.picoModal;
    var cm = editor.codemirror;
    var pos = cm.getCursor("start");
    var Xhr;

    var isImage = File.type.search('image/') == 0;
    
    var progressModal = picoModal({
      content: [
        "<h3>Uploading...</h3>"
        ,"<code><span class='pct'>0</span>% ",File.name, ' (',File.size,')</code>'
      ].join(''),
      overlayClose: false,
      closeHtml: "<span>Cancel</span>",
      closeStyles: {
          position: "absolute", bottom: "15px", right: "10px",
          background: "#eee", padding: "5px 10px", cursor: "pointer",
          borderRadius: "5px", border: "1px solid #ccc"
      },
      modalStyles: function (styles) { styles.top = '60px'; },
      focus: false,
      width: 550
    }).beforeClose(function(modal,event){
      if(Xhr && Xhr.readyState != 4) { // 4 means DONE
        Xhr.abort();
      }
    });
    
    progressModal.show();
    
    var PctEl = progressModal.modalElem().getElementsByClassName('pct')[0];
    
    var callback = function(E,event) {
      progressModal.close();
      var res = Ext.decode(E.currentTarget.responseText);
      if(res && res.filename && res.checksum) {
        var insertStr;
        if(isImage) {
          insertStr = [
            '<img ',"\n",
              '  src="','_ra-rel-mnt_/simplecas/fetch_content/',res.checksum,'/',res.filename,'" ',"\n",
              '  style="max-width:100%;"',"\n",
            ' />'
          ].join('');
          
          //insertStr = [
          //  '![',res.filename,']',
          //  '(','_ra-rel-mnt_/simplecas/fetch_content/',res.checksum,'/',res.filename,')'
          //].join('');
        }
        else {
          insertStr = [
            '[',res.filename,']',
            '(','_ra-rel-mnt_/simplecas/fetch_content/',res.checksum,'/',res.filename,')'
          ].join('');
        }
        
        cm.replaceRange(insertStr,pos);
        pos.ch = pos.ch + insertStr.length;
      
        cm.focus();
        cm.doc.setCursor(pos);
      }
    
      if(addlCallback) { addlCallback.apply(scope,arguments); }
    }
    
    Xhr = new XMLHttpRequest();
    
    Xhr.upload.addEventListener('progress', function(E) {
      var pct = Math.floor((E.loaded/E.total)*100);
      PctEl.innerHTML = pct;
    }, false);
    
    Xhr.addEventListener('load',  function(E) { callback(E,'load')  }, false);
    Xhr.addEventListener('error', function(E) { callback(E,'error') }, false);
    Xhr.addEventListener('abort', function(E) { callback(E,'abort') }, false);
    
    var formData = new FormData();
    formData.append('Filedata', File);
    
    Xhr.open('POST', '_ra-rel-mnt_/simplecas/upload_file');
    Xhr.send(formData);
  
  },
  
  customUploadActionFn: function(editor) {

    var picoModal = editor.options.picoModal;
    var modal, insertStr;
    var cm = editor.codemirror;
    var pos = cm.getCursor("start");
    
    var scope = this;

    var onClose = function(){
    
      if(insertStr) {
        cm.replaceRange(insertStr,pos);
        pos.ch = pos.ch + insertStr.length;
      }
      
      cm.focus();
      cm.doc.setCursor(pos);
    }
    
    function onInputChange(e) {
      var File = e.target.files[0];
      if(File) {
        modal.close();
        scope.doXhrCasUpload(File);
      }
    }
    
    modal = picoModal({
        content: [
          "<h3>Upload and insert image/file</h3>",
          '<form>',
            '<div><input type="file" name="Filedata" /></div>',
          '</form>'
        ].join(''),
        modalStyles: function (styles) { styles.top = '60px'; },
        focus: false,
        width: 550
      })
      .afterCreate(function(m){
        var input = m.modalElem().getElementsByTagName('input')[0];
        if(input) {
          input.onchange = onInputChange;
        }
      })
      //.afterClose(onClose)
      .show();
  },
  
  tearDown: function() {
    var iframe = this.iframeDom;
    if(iframe) {
      if(iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }
  }
  
});
Ext.reg('ra-md-editor',Ext.ux.RapidApp.MdEditor);


// This was started in order to be the parent class for MdEditor, but after a redesign it no longer 
// is. However, since its a working implementation of an iframe-based plaintext editor, it is being
// left in the code for future reference
Ext.ux.RapidApp.iframeTextField = Ext.extend(Ext.form.Field,{

  iframeHtmlHead: '<head></head>',
  syncOnKeyUp: true,
  
  initComponent: function() {
  
    this.iframeHtml = this.iframeHtml || [
      '<iframe frameborder="0" ',
      'srcdoc="',
      '<html>', 
      this.iframeHtmlHead,
      '<body style=\'margin:0px;\'>',
        '<textarea style=\'',
            'position:absolute; top:0; bottom:0; ;width:100%;',
            'border:0;',
         '\'></textarea>',
      '</body></html>',
      '"></iframe>'
    ].join('');
    
    this.autoCreate = {
      tag: 'div',
      html: this.iframeHtml
    };

    Ext.ux.RapidApp.iframeTextField.superclass.initComponent.call(this);
  },
  
  getIframeEl: function() {
    return this.el.first('iframe');
  },
  
  getTextAreaEl: function() {
    if(!this.textAreaEl) {
      var iframe = this.getIframeEl();
      var doc = iframe.dom.contentDocument;
      var bodyDom = doc.body;
      if(!bodyDom) { return null; }
      var el = new Ext.Element( bodyDom ).first('textarea');
      if(el && this.syncOnKeyUp) {
        el.on('keyup',this.onTextAreaKeyup,this);
        this.textAreaEl = el;
      }
    }
    return this.textAreaEl;
  },
  
  onTextAreaKeyup: function(e,dom) {
    this.syncValue(dom);
  },
  
  syncValue: function(dom) {
    if(!dom) {
      var el = this.getTextAreaEl();
      if(el) { dom = el.dom; }
    }
    if(dom) {
      this.value = dom.value;
    }
  },
  
  getRawValue: function() {
    this.syncValue();
    return this.value;
  },
  
  getValue : function(){
    return this.getRawValue();
  },
  
  setRawValue : function(v){
    return this.rendered ? (this.setTextAreaText(null,(Ext.isEmpty(v) ? '' : v))) : '';
  },

  setValue : function(v){
    this.value = v;
    if(this.rendered){
        this.setTextAreaText('set',Ext.isEmpty(v) ? '' : v);
    }
    return this;
  },

  setTextAreaText: function(opt,v,count) {
    count = count || 1;
    var el = this.getTextAreaEl();
    
    if(el) {
      el.dom.value = v;
      if(opt == 'set') {
        this.value = v;
        this.validate();
      }
    }
    else {
      this.setTextAreaText.defer(10,this,[opt,v,count+1]);
    }
  }
  
});


