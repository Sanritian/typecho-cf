(function (global, $) {
  if (!$) return;

  function createAttachmentUploader(config) {
    var uploadPanel = $(config.uploadPanelSelector);
    if (!uploadPanel.length) return null;

    var cid = uploadPanel.data('cid') || 0;
    var fileInput = $(config.fileInputSelector);
    var fileList = $(config.fileListSelector);
    var adminCsrfToken = config.csrfToken || '';
    var textarea = $(config.textareaSelector);

    function updateAttachmentNumber() {
      var btn = $(config.tabButtonSelector);
      var balloon = $('.balloon', btn);
      var count = $(config.fileListSelector + ' li .insert').length;
      if (count > 0) {
        if (!balloon.length) {
          btn.html($.trim(btn.html()) + ' ');
          balloon = $('<span class="balloon"></span>').appendTo(btn);
        }
        balloon.html(count);
      } else if (balloon.length) {
        balloon.remove();
      }
    }

    function insertFileToEditor(title, url, isImage) {
      var sel = textarea.getSelection();
      var relUrl = url;
      try {
        var u = new URL(url, location.origin);
        relUrl = u.pathname;
      } catch (e) {}
      var md = (isImage == 1 || isImage === true)
        ? '![' + title + '](' + relUrl + ')'
        : '[' + title + '](' + relUrl + ')';
      textarea.replaceSelection(md);
      textarea.setSelection(sel.start + md.length, sel.start + md.length);
      textarea.trigger('input');
    }

    function attachInsertEvent(el) {
      $('.insert', el).click(function (e) {
        e.preventDefault();
        var t = $(this);
        var p = t.parents('li');
        insertFileToEditor(t.text(), p.data('url'), p.data('image'));
      });
    }

    function attachDeleteEvent(el) {
      var name = $('a.insert', el).text();
      $('.delete', el).click(function (e) {
        e.preventDefault();
        if (!confirm('确认要删除文件 ' + name + ' 吗?')) return;
        var attachCid = $(el).data('cid');
        $.ajax({
          url: '/api/admin/upload?cid=' + attachCid + '&_=' + encodeURIComponent(String(adminCsrfToken)),
          type: 'DELETE',
          dataType: 'json',
          success: function () {
            $(el).fadeOut(function () {
              $(this).remove();
              updateAttachmentNumber();
            });
          }
        });
      });
    }

    function fileUploadStart(name, id) {
      $('<li id="upload-' + id + '" class="loading">' + name + '</li>').appendTo(fileList);
    }

    function fileUploadComplete(id, data) {
      var li = $('#upload-' + id).removeClass('loading')
        .data('cid', data.cid).data('url', data.url).data('image', data.isImage)
        .html('<input type="hidden" name="attachment[]" value="' + data.cid + '" />'
          + '<a class="insert" target="_blank" href="#" title="点击插入文件">' + data.title + '</a>'
          + '<div class="info">' + data.bytes
          + ' <a class="delete" href="#" title="删除"><i class="i-delete"></i></a></div>');
      attachInsertEvent(li);
      attachDeleteEvent(li);
      updateAttachmentNumber();
    }

    function fileUploadError(id, msg) {
      var exist = $('#upload-' + id);
      if (exist.length) {
        exist.removeClass('loading').html(msg).css('color', '#B94A48');
        setTimeout(function () { exist.fadeOut(function () { $(this).remove(); }); }, 3000);
      }
    }

    async function doUpload(files) {
      for (var i = 0; i < files.length; i++) {
        (function (file, idx) {
          var uid = Date.now().toString(36) + idx;
          fileUploadStart(file.name, uid);

          var fd = new FormData();
          fd.append('file', file);
          fd.append('cid', String(cid));
          fd.append('_', String(adminCsrfToken));

          $.ajax({
            url: '/api/admin/upload',
            type: 'POST',
            data: fd,
            processData: false,
            contentType: false,
            dataType: 'json',
            success: function (resp) {
              if ($.isArray(resp) && resp[1]) {
                fileUploadComplete(uid, resp[1]);
                if (!cid && resp[1].cid) {
                  cid = resp[1].cid;
                }
              } else if (resp && resp.error) {
                fileUploadError(uid, file.name + ' 上传失败: ' + resp.error);
              }
            },
            error: function () {
              fileUploadError(uid, file.name + ' 上传失败');
            }
          });
        })(files[i], i);
      }
    }

    $(config.uploadFileTriggerSelector).click(function (e) {
      e.preventDefault();
      fileInput.click();
    });

    fileInput.change(function () {
      if (this.files && this.files.length) {
        doUpload(this.files);
        this.value = '';
      }
    });

    var uploadArea = $(config.uploadAreaSelector);
    uploadArea.on('dragenter dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      $(this).parent().addClass('drag');
    }).on('dragleave dragend', function (e) {
      e.preventDefault();
      e.stopPropagation();
      $(this).parent().removeClass('drag');
    }).on('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();
      $(this).parent().removeClass('drag');
      var files = e.originalEvent.dataTransfer.files;
      if (files && files.length) doUpload(files);
    });

    $(config.fileListSelector + ' li').each(function () {
      attachInsertEvent(this);
      attachDeleteEvent(this);
    });

    if ($.fn.pastableTextarea) {
      textarea.pastableTextarea().on('pasteImage', function (e, data) {
        if (data.blob) {
          var file = new File([data.blob], data.name || ('paste-' + Date.now() + '.png'), { type: 'image/png' });
          doUpload([file]);
        }
      });
    }

    updateAttachmentNumber();

    return {
      doUpload: doUpload,
      insertFileToEditor: insertFileToEditor,
      updateAttachmentNumber: updateAttachmentNumber,
    };
  }

  global.TypechoAdmin = global.TypechoAdmin || {};
  global.TypechoAdmin.createAttachmentUploader = createAttachmentUploader;
})(window, window.jQuery);
