import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { createConversation, sendMessage } from './lib/customgpt';
import { Send, Save, BookOpen, MessageSquare, Loader2, Paperclip, Trash2, CheckCircle, MessageCircle, FileIcon, RefreshCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './index.css';

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
}

interface Attachment {
  name: string;
  url: string;
}

interface Reply {
  author: string;
  text: string;
  created_at: string;
}

interface Annotation {
  id: string;
  content: string;
  created_at: string;
  resolved: boolean;
  replies: Reply[];
  attachments: Attachment[];
}

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'bot', text: 'Hola, este es el ambiente de prueba del chatbot para Intima Hoteles. Comienza como quieras para iniciar las pruebas' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [noteInput, setNoteInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [notes, setNotes] = useState<Annotation[]>([]);
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [activeReply, setActiveReply] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Initialize CustomGPT Session
    createConversation('Prueba MVP INTIMO')
      .then(id => setSessionId(id))
      .catch(err => console.error("Error creating session:", err));

    // Load annotations
    fetchNotes();
  }, []);

  useEffect(() => {
    // Scroll to bottom of chat
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const fetchNotes = async () => {
    const { data, error } = await supabase
      .from('intima_annotations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setNotes(data);
    if (error) console.error("Error fetching notes:", error);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: input.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await sendMessage(sessionId, userMessage.text);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: responseText
      };
      
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'Hubo un error al procesar tu solicitud. Por favor intenta de nuevo.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const id = await createConversation('Prueba MVP INTIMO');
      setSessionId(id);
      setMessages([
        { id: Date.now().toString(), sender: 'bot', text: 'Hola, este es el ambiente de prueba del chatbot para Intima Hoteles. Comienza como quieras para iniciar las pruebas' }
      ]);
    } catch (err) {
      console.error("Error creating new session:", err);
      alert("Error al reiniciar el chat.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleSaveNote = async () => {
    if ((!noteInput.trim() && selectedFiles.length === 0) || isSavingNote) return;
    
    setIsSavingNote(true);
    try {
      // Upload files first
      const uploadedAttachments: Attachment[] = [];
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('intima_attachments')
          .upload(filePath, file);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('intima_attachments')
          .getPublicUrl(filePath);
          
        uploadedAttachments.push({ name: file.name, url: publicUrl });
      }

      const { data, error } = await supabase
        .from('intima_annotations')
        .insert([{ 
          content: noteInput.trim(),
          attachments: uploadedAttachments,
          resolved: false,
          replies: []
        }])
        .select();
        
      if (error) throw error;
      
      if (data) {
        setNotes(prev => [data[0], ...prev]);
        setNoteInput('');
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Hubo un error al guardar la anotación.");
    } finally {
      setIsSavingNote(false);
    }
  };

  const toggleResolved = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('intima_annotations').update({ resolved: !currentStatus }).eq('id', id);
    if (!error) fetchNotes();
  };

  const deleteNote = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta anotación?')) return;
    const { error } = await supabase.from('intima_annotations').delete().eq('id', id);
    if (!error) fetchNotes();
  };

  const submitReply = async (note: Annotation) => {
    const text = replyInputs[note.id];
    if (!text?.trim()) return;
    
    const newReply = { author: 'Desarrollador', text: text.trim(), created_at: new Date().toISOString() };
    const updatedReplies = [...(note.replies || []), newReply];
    
    const { error } = await supabase.from('intima_annotations').update({ replies: updatedReplies }).eq('id', note.id);
    if (!error) {
      setReplyInputs(prev => ({ ...prev, [note.id]: '' }));
      setActiveReply(null);
      fetchNotes();
    }
  };

  return (
    <div className="app-container">
      {/* Chat Panel */}
      <div className="panel">
        <div className="panel-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <MessageSquare size={24} color="var(--accent-gold)" />
            <h2>INTIMO Chatbot MVP</h2>
          </div>
          <button 
            onClick={handleResetChat} 
            className="btn-reset-chat" 
            title="Nuevo Chat / Reiniciar"
            disabled={isLoading}
          >
            <RefreshCcw size={16} />
            <span className="reset-text">Nuevo Chat</span>
          </button>
        </div>
        
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.sender}`}>
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message bot">
              <div className="typing-indicator">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="chat-input-container">
          <form className="chat-input-form" onSubmit={handleSendMessage}>
            <input 
              type="text" 
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe un mensaje al bot..."
              disabled={!sessionId || isLoading}
            />
            <button 
              type="submit" 
              className="btn-send"
              disabled={!input.trim() || !sessionId || isLoading}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>

      {/* Notebook Panel */}
      <div className="panel">
        <div className="panel-header">
          <BookOpen size={24} color="var(--accent-gold)" />
          <h2>Libreta de Anotaciones</h2>
        </div>
        
        <div className="notes-container">
          <div className="note-input-area">
            <textarea 
              className="note-textarea"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Escribe aquí tus observaciones, feedback o bugs encontrados durante la prueba..."
            ></textarea>
            
            <div className="note-actions-row">
              <div className="file-upload-wrapper">
                <input 
                  type="file" 
                  multiple 
                  id="file-upload" 
                  ref={fileInputRef}
                  className="hidden-file-input"
                  onChange={handleFileChange}
                />
                <label htmlFor="file-upload" className="btn-icon" title="Adjuntar archivos">
                  <Paperclip size={18} />
                  <span>Adjuntar ({selectedFiles.length})</span>
                </label>
              </div>
              
              <button 
                className="btn-save" 
                onClick={handleSaveNote}
                disabled={(!noteInput.trim() && selectedFiles.length === 0) || isSavingNote}
              >
                {isSavingNote ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                Guardar Anotación
              </button>
            </div>
          </div>
          
          <div className="notes-list">
            {notes.map((note) => (
              <div key={note.id} className={`note-card ${note.resolved ? 'resolved-card' : ''}`}>
                <div className="note-header-actions">
                  <div className="note-date">
                    {new Date(note.created_at).toLocaleString('es-ES', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </div>
                  <div className="note-action-buttons">
                    <button 
                      onClick={() => toggleResolved(note.id, note.resolved)} 
                      className={`btn-action ${note.resolved ? 'active-resolve' : ''}`}
                      title={note.resolved ? 'Marcar como no resuelta' : 'Marcar como resuelta'}
                    >
                      <CheckCircle size={16} />
                    </button>
                    <button 
                      onClick={() => setActiveReply(activeReply === note.id ? null : note.id)} 
                      className="btn-action"
                      title="Responder"
                    >
                      <MessageCircle size={16} />
                    </button>
                    <button 
                      onClick={() => deleteNote(note.id)} 
                      className="btn-action danger"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="note-content">
                  {note.content}
                </div>
                
                {note.attachments && note.attachments.length > 0 && (
                  <div className="note-attachments">
                    {note.attachments.map((att, idx) => (
                      <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="attachment-link">
                        <FileIcon size={14} />
                        {att.name}
                      </a>
                    ))}
                  </div>
                )}
                
                {/* Replies Display */}
                {note.replies && note.replies.length > 0 && (
                  <div className="replies-container">
                    {note.replies.map((reply, idx) => (
                      <div key={idx} className="reply-card">
                        <div className="reply-header">
                          <span className="reply-author">{reply.author}</span>
                          <span className="reply-date">
                            {new Date(reply.created_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="reply-text">{reply.text}</div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Reply Input Area */}
                {activeReply === note.id && (
                  <div className="reply-input-area">
                    <textarea 
                      placeholder="Escribe una respuesta como desarrollador..."
                      value={replyInputs[note.id] || ''}
                      onChange={(e) => setReplyInputs(prev => ({ ...prev, [note.id]: e.target.value }))}
                      className="reply-textarea"
                    />
                    <div className="reply-actions">
                      <button onClick={() => setActiveReply(null)} className="btn-cancel">Cancelar</button>
                      <button 
                        onClick={() => submitReply(note)} 
                        className="btn-submit-reply"
                        disabled={!replyInputs[note.id]?.trim()}
                      >
                        Enviar Respuesta
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
