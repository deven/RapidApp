

Ext.ns('Ext.ux.RapidApp.Plugin.HtmlEditor');
Ext.ux.RapidApp.Plugin.HtmlEditor.SimpleCAS_Image = Ext.extend(Ext.ux.form.HtmlEditor.Image,{
	
	constructor: function(cnf) {
		Ext.apply(this,cnf);
	},
	
	maxImageWidth: null,
	
	resizeWarn: false,
	
	onRender: function() {
		var btn = this.cmp.getToolbar().addButton({
				text: 'Insert Image',
				iconCls: 'x-edit-image',
				handler: this.selectImage,
				scope: this,
				tooltip: {
					title: this.langTitle
				},
				overflowText: this.langTitle
		});
	},
	
	selectImage: function() {
		var upload_field = {
			xtype: 'fileuploadfield',
			emptyText: 'Select image',
			fieldLabel:'Select Image',
			name: 'Filedata',
			buttonText: 'Browse',
			width: 300
		};
		
		var fieldset = {
			style: 'border: none',
			hideBorders: true,
			xtype: 'fieldset',
			labelWidth: 70,
			border: false,
			items:[ upload_field ]
		};
		
		var callback = function(form,res) {
			var img = Ext.decode(res.response.responseText);
			
			if(this.resizeWarn && img.resized) {
				Ext.Msg.show({
					title:'Notice: Image Resized',
					msg: 
						'The image has been resized by the server.<br><br>' +
						'Original Size: <b>' + img.orig_width + 'x' + img.orig_height + '</b><br><br>' +
						'New Size: <b>' + img.width + 'x' + img.height + '</b>'
					,
					buttons: Ext.Msg.OK,
					icon: Ext.MessageBox.INFO
				});
			}
			
			img.link_url = '/simplecas/fetch_content/' + img.checksum + '/' + img.filename;
			this.insertImage(img);
		};
		
		var url = '/simplecas/upload_image';
		if(this.maxImageWidth) { url += '/' + this.maxImageWidth; }
		
		Ext.ux.RapidApp.WinFormPost.call(this,{
			title: 'Insert Image',
			width: 430,
			height:140,
			url: url,
			useSubmit: true,
			fileUpload: true,
			fieldset: fieldset,
			success: callback
		});
	},

	insertImage: function(img) {
		if(!this.cmp.activated) {
			this.cmp.onFirstFocus();
		}
		this.cmp.insertAtCursor(
			'<img src="' + img.link_url + '" width=' + img.width + ' height=' + img.height + '>'
		);
	}
});
Ext.preg('htmleditor-casimage',Ext.ux.RapidApp.Plugin.HtmlEditor.SimpleCAS_Image);

Ext.ux.RapidApp.Plugin.HtmlEditor.DVSelect = Ext.extend(Ext.util.Observable, {
	
	// This should be defined in consuming class
	dataview: { xtype: 'panel', 	html: '' },
	
	// This should be defined in consuming class
	getInsertStr: function(Records) {},
	
	title: 'Select Item',
	height: 400,
	width: 500,
	
	constructor: function(cnf) {
		Ext.apply(this,cnf);
	},
	
	init: function(cmp){
		this.cmp = cmp;
		this.cmp.on('render', this.onRender, this);
		
		if(Ext.isIE) {
			// Need to do this in IE because if the user tries to insert an image before the editor
			// is "activated" it will go no place. Unlike FF, in IE the only way to get it activated
			// is to click in it. The editor will automatically enable its toolbar buttons again when
			// its activated.
			this.cmp.on('afterrender',this.disableToolbarInit, this,{delay:1000, single: true});
		}
	},
	
	disableToolbarInit: function() {
		if(!this.cmp.activated) {
			this.cmp.getToolbar().disable();
		}
	},
	
	onRender: function() {
		
		this.btn = this.cmp.getToolbar().addButton({
				iconCls: 'x-edit-image',
				handler: this.loadDVSelect,
				text: this.title,
				scope: this
				//tooltip: {
				//	title: this.langTitle
				//},
				//overflowText: this.langTitle
		});
	},
	
	insertContent: function(str) {
		if(!this.cmp.activated) {
			// This works in FF, but not in IE:
			this.cmp.onFirstFocus();
		}
		this.cmp.insertAtCursor(str);

	},
	
	loadDVSelect: function() {
		
		if (this.dataview_enc) { this.dataview = Ext.decode(this.dataview_enc); }
		
		this.dataview.itemId = 'dv';
		
		this.win = new Ext.Window({
			title: this.title,
			layout: 'fit',
			width: this.width,
			height: this.height,
			closable: true,
			modal: true,
			items: this.dataview,
			buttons: [
				{
					text : 'Select',
					scope: this,
					handler : function() {
						
						var dv = this.win.getComponent('dv');
						
						var recs = dv.getSelectedRecords();
						if (recs.length == 0) { return; }
						
						var str = this.getInsertStr(recs);
						this.win.close();
						return this.insertContent(str);
					}
				},
				{
					text : 'Cancel',
					scope: this,
					handler : function() {
						this.win.close();
					}
				}
			]
		});
		
		this.win.show();
	}
});
Ext.preg('htmleditor-dvselect',Ext.ux.RapidApp.Plugin.HtmlEditor.DVSelect);

Ext.ux.RapidApp.Plugin.HtmlEditor.AutoSizers = Ext.extend(Ext.util.Observable, {
	// private
	init: function(cmp){
		this.cmp = cmp;
		this.cmp.on('render', this.onRender, this);
		this.cmp.on('push', this.onPush, this);
		this.cmp.autoHeightUp = function() {
			var editorBody = this.getEditorBody();
			if (editorBody.scrollHeight > editorBody.clientHeight) {

				var tbheight = this.getToolbar().getHeight();
				var height = editorBody.scrollHeight + tbheight + 5;
				if (height < this.initialConfig.height) {
					height = this.initialConfig.height;
				}
				if(this.Resizer) {
					this.Resizer.resizeTo(this.getWidth(),height);
				}
				else {
					this.setHeight(height);
					this.wrap.setHeight(height);
				}
			}
		};
		this.cmp.setMinHeight = function() {
			var height = this.initialConfig.minHeight || 150;
			if(this.Resizer) {
				this.Resizer.resizeTo(this.getWidth(),height);
			}
			else {
				this.setHeight(height);
				this.wrap.setHeight(height);
			}
		};
	},

	onPush: function() {
		if(this.initExpanded) { return; }
		this.cmp.autoHeightUp();
		this.initExpanded = true;
	},

	// private
	onRender: function(){
		this.cmp.getToolbar().add(
			'->',
			new Ext.ux.RapidApp.BoxToolBtn({
				toolType: 'minimize',
				toolQtip: 'Min Height',
				handler: this.cmp.setMinHeight,
				scope: this.cmp
			}),
			new Ext.ux.RapidApp.BoxToolBtn({
				toolType: 'maximize',
				toolQtip: 'Expand Height',
				handler: this.cmp.autoHeightUp,
				scope: this.cmp
			})
		);
	}
});
Ext.preg('htmleditor-autosizers',Ext.ux.RapidApp.Plugin.HtmlEditor.AutoSizers);


Ext.ux.RapidApp.Plugin.HtmlEditor.LoadHtmlFile = Ext.extend(Ext.util.Observable, {
	
	title: 'Load Html',
	height: 400,
	width: 500,
	
	constructor: function(cnf) {
		Ext.apply(this,cnf);
	},
	
	init: function(cmp){
		this.cmp = cmp;
		this.cmp.on('render', this.onRender, this);
	},
	
	onRender: function() {
		
		this.btn = this.cmp.getToolbar().addButton({
				iconCls: 'icon-page-white-world',
				handler: this.selectHtmlFile,
				text: this.title,
				scope: this
				//tooltip: {
				//	title: this.langTitle
				//},
				//overflowText: this.langTitle
		});
	},
	
	replaceContent: function(str) {
		if(!this.cmp.activated) {
			// This works in FF, but not in IE:
			this.cmp.onFirstFocus();
		}
		this.cmp.setValue(str);
	},
	
	selectHtmlFile: function() {
		var upload_field = {
			xtype: 'fileuploadfield',
			emptyText: 'Select html or mht file',
			fieldLabel:'Html/Mht File',
			name: 'Filedata',
			buttonText: 'Browse',
			width: 300
		};
		
		var fieldset = {
			style: 'border: none',
			hideBorders: true,
			xtype: 'fieldset',
			labelWidth: 80,
			border: false,
			items:[ upload_field ]
		};
		
		var callback = function(form,res) {
			var packet = Ext.decode(res.response.responseText);
			this.replaceContent(packet.content);
		};
		
		Ext.ux.RapidApp.WinFormPost.call(this,{
			title: 'Load html file (replace existing content)',
			width: 440,
			height:140,
			url:'/simplecas/texttranscode/transcode_html',
			useSubmit: true,
			fileUpload: true,
			fieldset: fieldset,
			success: callback
			//failure: callback
		});
	}
});
Ext.preg('htmleditor-loadhtml',Ext.ux.RapidApp.Plugin.HtmlEditor.LoadHtmlFile);


Ext.ux.RapidApp.Plugin.HtmlEditor.InsertFile = Ext.extend(Ext.util.Observable, {
	
	title: 'Insert File',
	height: 400,
	width: 500,
	
	constructor: function(cnf) {
		Ext.apply(this,cnf);
	},
	
	init: function(cmp){
		this.cmp = cmp;
		this.cmp.on('render', this.onRender, this);
		
		var getDocMarkup_orig = this.cmp.getDocMarkup;
		this.cmp.getDocMarkup = function() {
			return '<link rel="stylesheet" type="text/css" href="/static/rapidapp/css/filelink.css" />' +
				getDocMarkup_orig.apply(this,arguments);
		}
	},
	
	onRender: function() {
		this.btn = this.cmp.getToolbar().addButton({
				iconCls: 'icon-page-white-world',
				handler: this.selectFile,
				text: this.title,
				scope: this
				//tooltip: {
				//	title: this.langTitle
				//},
				//overflowText: this.langTitle
		});
	},
	
	insertContent: function(str) {
		if(!this.cmp.activated) {
			// This works in FF, but not in IE:
			this.cmp.onFirstFocus();
		}
		this.cmp.insertAtCursor(str);
	},
	
	selectFile: function() {
		var upload_field = {
			xtype: 'fileuploadfield',
			emptyText: 'Select file',
			fieldLabel:'Select File',
			name: 'Filedata',
			buttonText: 'Browse',
			width: 300
		};
		
		var fieldset = {
			style: 'border: none',
			hideBorders: true,
			xtype: 'fieldset',
			labelWidth: 70,
			border: false,
			items:[ upload_field ]
		};
		
		var callback = function(form,res) {
			var packet = Ext.decode(res.response.responseText);
			var url = '/simplecas/fetch_content/' + packet.checksum + '/' + packet.filename;
			var link = '<a class="' + packet.css_class + '" href="' + url + '">' + packet.filename + '</a>';
			this.insertContent(link);
		};
		
		Ext.ux.RapidApp.WinFormPost.call(this,{
			title: 'Insert file',
			width: 430,
			height:140,
			url:'/simplecas/upload_file',
			useSubmit: true,
			fileUpload: true,
			fieldset: fieldset,
			success: callback
		});
	}
});
Ext.preg('htmleditor-insertfile',Ext.ux.RapidApp.Plugin.HtmlEditor.InsertFile);


Ext.ns('Ext.ux.RapidApp.Plugin.HtmlEditor');
Ext.ux.RapidApp.HtmlEditor = Ext.extend(Ext.form.HtmlEditor,{
	initComponent: function() {
		var plugins = this.plugins || [];
		if(!Ext.isArray(plugins)) { plugins = [ this.plugins ]; }
		
		plugins.push(
			'htmleditor-autosizers',
			new Ext.ux.form.HtmlEditor.Break(),
			'htmleditor-loadhtml',
			'htmleditor-insertfile',
			{
				ptype: 'htmleditor-casimage',
				maxImageWidth: 800,
				resizeWarn: true
			},
			new Ext.ux.form.HtmlEditor.SpecialCharacters(),
			new Ext.ux.form.HtmlEditor.UndoRedo(),
			new Ext.ux.form.HtmlEditor.Divider(),
			new Ext.ux.form.HtmlEditor.Table(),
			new Ext.ux.form.HtmlEditor.IndentOutdent(),
			new Ext.ux.form.HtmlEditor.SubSuperScript(),
			'clickablelinks'
		);
		this.plugins = plugins;
			
		if(this.resizable) {
			this.on('initialize',function(){
				var Field = this;
				var minHeight = this.minHeight || 50;
				var minWidth = this.minWidth || 100;
				
				this.Resizer = new Ext.Resizable(this.wrap, {
					minHeight: minHeight,
					minWidth: minWidth,
					pinned: true,
					handles: 'se',
					//handles: 's,e,se',
					//dynamic: true,
					listeners : {
						'resize' : function(resizable,width,height) {
							//height = height - 6; //<-- adjust for size of resizer (needed when handles: 's')
							Field.setSize(width,height);
						}
					}
				});
				// Manually fire resize to trigger init adjustment for resizer
				//var size = this.wrap.getSize();
				//resizer.resizeTo(size.width,size.height);
			},this);
		}
			
		Ext.ux.RapidApp.HtmlEditor.superclass.initComponent.call(this);
	}
});
Ext.reg('ra-htmleditor',Ext.ux.RapidApp.HtmlEditor);
