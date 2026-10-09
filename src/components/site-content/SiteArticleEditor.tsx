import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import {
  editableSiteHtml,
  resolveSiteMediaUrl,
  storedSiteHtml,
} from '../../api/site-client';
import { siteContentService } from '../../services/site-content.service';

interface SiteArticleEditorProps {
  title: string;
  description: string;
  banner: string | null;
  content: string;
  disabled?: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBannerChange: (value: string | null) => void;
  onContentChange: (value: string) => void;
  onError: (message: string) => void;
}

export function SiteArticleEditor({
  title,
  description,
  banner,
  content,
  disabled = false,
  onTitleChange,
  onDescriptionChange,
  onBannerChange,
  onContentChange,
  onError,
}: SiteArticleEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(
    null,
  );

  const syncContent = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    onContentChange(storedSiteHtml(editor.innerHTML));
  }, [onContentChange]);

  const rememberSelection = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (storedSiteHtml(editor.innerHTML) !== content) {
      editor.innerHTML = editableSiteHtml(content);
      setSelectedImage(null);
    }
  }, [content]);

  const format = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    rememberSelection();
    syncContent();
  };

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Можно загружать только изображения');
    }
    const result = await siteContentService.upload(file);
    return result.imagePath;
  }

  async function uploadBanner(file: File) {
    setUploading(true);
    try {
      onBannerChange(await upload(file));
    } catch (error) {
      onError(
        error instanceof Error ? error.message : 'Не удалось загрузить баннер',
      );
    } finally {
      setUploading(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  }

  async function uploadContentImage(file: File) {
    setUploading(true);
    try {
      const imagePath = await upload(file);
      const editor = editorRef.current;
      if (!editor) return;

      const image = document.createElement('img');
      image.src = resolveSiteMediaUrl(imagePath);
      image.alt = file.name;
      image.dataset.siteUpload = imagePath;
      image.style.maxWidth = '100%';
      image.style.height = 'auto';
      image.style.display = 'block';
      image.style.margin = '16px 0';

      const paragraph = document.createElement('p');
      paragraph.appendChild(document.createElement('br'));
      const range = selectionRef.current;
      if (range && editor.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(paragraph);
        range.insertNode(image);
      } else {
        editor.append(image, paragraph);
      }

      const nextRange = document.createRange();
      nextRange.selectNodeContents(paragraph);
      nextRange.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(nextRange);
      selectionRef.current = nextRange.cloneRange();
      syncContent();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить изображение',
      );
    } finally {
      setUploading(false);
      if (contentInputRef.current) contentInputRef.current.value = '';
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const imageItem = [...event.clipboardData.items].find((item) =>
      item.type.startsWith('image/'),
    );
    const file = imageItem?.getAsFile();
    if (!file) return;
    event.preventDefault();
    rememberSelection();
    void uploadContentImage(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = [...event.dataTransfer.files].find((item) =>
      item.type.startsWith('image/'),
    );
    if (!file) return;
    rememberSelection();
    void uploadContentImage(file);
  }

  function updateSelectedImage(update: (image: HTMLImageElement) => void) {
    if (!selectedImage) return;
    update(selectedImage);
    syncContent();
  }

  return (
    <section className="site-editor card">
      <div className="site-editor-title">
        <label htmlFor="site-news-title">Заголовок статьи</label>
        <input
          id="site-news-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Что нового в Hub"
          maxLength={180}
          disabled={disabled}
          required
        />
      </div>

      <div className="site-editor-banner">
        {banner ? (
          <div className="site-banner-preview">
            <img src={resolveSiteMediaUrl(banner)} alt="Баннер статьи" />
            <button
              type="button"
              className="button danger"
              onClick={() => onBannerChange(null)}
              disabled={disabled}
            >
              Удалить баннер
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="site-upload-placeholder"
            onClick={() => bannerInputRef.current?.click()}
            disabled={disabled || uploading}
          >
            <strong>{uploading ? 'Загрузка…' : 'Добавить баннер'}</strong>
            <span>JPG, PNG, WebP или GIF, до 5 МБ</span>
          </button>
        )}
        <input
          ref={bannerInputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadBanner(file);
          }}
        />
      </div>

      <div className="site-editor-description">
        <label htmlFor="site-news-description">Краткое описание</label>
        <textarea
          id="site-news-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Короткий анонс для карточек на главной"
          rows={3}
          maxLength={600}
          disabled={disabled}
          required
        />
      </div>

      <div
        className="site-editor-toolbar"
        role="toolbar"
        aria-label="Форматирование статьи"
      >
        {(
          [
            ['bold', 'B', 'Жирный'],
            ['italic', 'I', 'Курсив'],
            ['underline', 'U', 'Подчёркнутый'],
          ] as const
        ).map(([command, label, title]) => (
          <button
            key={command}
            type="button"
            title={title}
            aria-label={title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => format(command)}
            disabled={disabled}
          >
            {label}
          </button>
        ))}
        <span />
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format('insertUnorderedList')}
          disabled={disabled}
        >
          • Список
        </button>
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => format('insertOrderedList')}
          disabled={disabled}
        >
          1. Список
        </button>
        <span />
        <button
          type="button"
          onClick={() => format('justifyLeft')}
          disabled={disabled}
        >
          По левому
        </button>
        <button
          type="button"
          onClick={() => format('justifyCenter')}
          disabled={disabled}
        >
          По центру
        </button>
        <button
          type="button"
          onClick={() => format('justifyRight')}
          disabled={disabled}
        >
          По правому
        </button>
        <span className="site-toolbar-spacer" />
        <button
          type="button"
          className="site-toolbar-upload"
          onClick={() => {
            rememberSelection();
            contentInputRef.current?.click();
          }}
          disabled={disabled || uploading}
        >
          {uploading ? 'Загрузка…' : 'Вставить изображение'}
        </button>
        <input
          ref={contentInputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadContentImage(file);
          }}
        />
      </div>

      <div
        ref={editorRef}
        className="site-editor-content"
        contentEditable={!disabled}
        data-placeholder="Начните писать статью…"
        onInput={syncContent}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        onClick={(event) => {
          const target = event.target;
          setSelectedImage(target instanceof HTMLImageElement ? target : null);
        }}
        suppressContentEditableWarning
      />

      {selectedImage && (
        <div className="site-media-controls" aria-label="Настройки изображения">
          <span>Изображение</span>
          <button
            type="button"
            onClick={() =>
              updateSelectedImage((image) => {
                image.style.width = `${Math.max(image.offsetWidth - 50, 100)}px`;
              })
            }
          >
            Уменьшить
          </button>
          <button
            type="button"
            onClick={() =>
              updateSelectedImage((image) => {
                image.style.width = `${Math.min(image.offsetWidth + 50, 900)}px`;
              })
            }
          >
            Увеличить
          </button>
          <button
            type="button"
            onClick={() =>
              updateSelectedImage((image) => {
                image.style.float = 'left';
                image.style.margin = '0 16px 12px 0';
              })
            }
          >
            Слева
          </button>
          <button
            type="button"
            onClick={() =>
              updateSelectedImage((image) => {
                image.style.float = 'none';
                image.style.margin = '16px auto';
              })
            }
          >
            По центру
          </button>
          <button
            type="button"
            onClick={() =>
              updateSelectedImage((image) => {
                image.style.float = 'right';
                image.style.margin = '0 0 12px 16px';
              })
            }
          >
            Справа
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => {
              selectedImage.remove();
              setSelectedImage(null);
              syncContent();
            }}
          >
            Удалить
          </button>
        </div>
      )}
    </section>
  );
}
