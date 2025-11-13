/**
 * Tests for FileUpload component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUpload } from './FileUpload';

describe('FileUpload', () => {
  it('should render file upload area with instructions', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    // Should show drag and drop instructions
    expect(screen.getByText(/drop your epub or pdf here/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
  });

  it('should show supported file types', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    // Should mention EPUB and PDF
    expect(screen.getByText(/epub/i)).toBeInTheDocument();
    expect(screen.getByText(/pdf/i)).toBeInTheDocument();
  });

  it('should show file size limit', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    // Should show 10MB limit
    expect(screen.getByText(/10.*mb/i)).toBeInTheDocument();
  });

  it('should have hidden file input with correct attributes', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', '.epub,.pdf');
  });

  it('should call onFileSelected with EPUB file data', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['epub content'], 'book.epub', { type: 'application/epub+zip' });

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    expect(onFileSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'book.epub',
        type: 'epub',
        size: expect.any(Number),
        file: expect.any(File),
      })
    );
  });

  it('should call onFileSelected with PDF file data', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf content'], 'document.pdf', { type: 'application/pdf' });

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    expect(onFileSelected).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'document.pdf',
        type: 'pdf',
        size: expect.any(Number),
        file: expect.any(File),
      })
    );
  });

  it('should reject files larger than 10MB', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Create 11MB file
    const largeContent = new Array(11 * 1024 * 1024).fill('x').join('');
    const largeFile = new File([largeContent], 'large.epub', {
      type: 'application/epub+zip',
    });

    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });

    fireEvent.change(input);

    // Should show error message instead of alert
    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    expect(screen.getByText(/file too large.*maximum size is 10mb/i)).toBeInTheDocument();
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it('should reject unsupported file types', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const txtFile = new File(['text'], 'file.txt', { type: 'text/plain' });

    Object.defineProperty(input, 'files', {
      value: [txtFile],
      writable: false,
    });

    fireEvent.change(input);

    // Should show error message
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid file type.*please upload an epub or pdf/i)).toBeInTheDocument();
    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it('should handle missing file selection gracefully', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [],
      writable: false,
    });

    fireEvent.change(input);

    expect(onFileSelected).not.toHaveBeenCalled();
  });

  it('should handle drag and drop events', () => {
    const onFileSelected = vi.fn();
    render(<FileUpload onFileSelected={onFileSelected} />);

    const dropZone = screen.getByText(/drop your epub or pdf here/i).closest('div');
    expect(dropZone).toBeInTheDocument();

    // Test drag over
    fireEvent.dragOver(dropZone!);

    // Test drop
    const file = new File(['content'], 'test.epub', { type: 'application/epub+zip' });
    const dataTransfer = {
      files: [file],
      items: [{
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      }],
      types: ['Files'],
    };

    fireEvent.drop(dropZone!, { dataTransfer });

    expect(onFileSelected).toHaveBeenCalled();
  });
});
