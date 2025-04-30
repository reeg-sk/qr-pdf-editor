import React, { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;

const App: React.FC = () => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [showQr, setShowQr] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [qrPosition, setQrPosition] = useState<{ x: number; y: number }>({ x: 20, y: 20 });
  const [dragging, setDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);
  const [qrScale, setQrScale] = useState<number>(1.0);
  const [uploadedFileName, setUploadedFileName] = useState<string>("edited.pdf");

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setUploadedFileName(file.name.replace(/\.pdf$/i, "") + "-edited.pdf");
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const goToPrevPage = () => setPageNumber((prev) => Math.max(prev - 1, 1));
  const goToNextPage = () => setPageNumber((prev) => Math.min(prev + 1, numPages));

  // Mouse event handlers for dragging QR
  const handleQrMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setDragging(true);
    const rect = pdfContainerRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - qrPosition.x,
        y: e.clientY - rect.top - qrPosition.y,
      });
    }
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const rect = pdfContainerRef.current?.getBoundingClientRect();
    if (rect) {
      let newX = e.clientX - rect.left - dragOffset.x;
      let newY = e.clientY - rect.top - dragOffset.y;
      // Optional: clamp to container
      newX = Math.max(0, Math.min(newX, rect.width - 88)); // 80 QR + 8 padding
      newY = Math.max(0, Math.min(newY, rect.height - 88));
      setQrPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  // Helper to save the edited PDF (current page with QR overlay)
  const handleSavePdf = async () => {
    if (!pdfContainerRef.current) return;
    const pdfDiv = pdfContainerRef.current;
    // Find the rendered PDF page canvas
    const pageCanvas = pdfDiv.querySelector("canvas");
    if (!pageCanvas) return;

    // Use the original canvas size for best quality
    const width = pageCanvas.width;
    const height = pageCanvas.height;

    // Create a new canvas to combine PDF page and QR overlay
    const combinedCanvas = document.createElement("canvas");
    combinedCanvas.width = width;
    combinedCanvas.height = height;
    const ctx = combinedCanvas.getContext("2d");
    if (!ctx) return;

    // Draw the PDF page at native resolution
    ctx.drawImage(pageCanvas, 0, 0, width, height);

    // Draw the QR code if shown
    if (showQr && qrUrl) {
      // Find the QR code canvas
      const qrCanvas = pdfDiv.querySelector("canvas[aria-label='Scan me!']");
      const qrCanvasEl = qrCanvas || pdfDiv.querySelectorAll("canvas")[1];
      if (qrCanvasEl) {
        // Calculate QR position relative to PDF canvas at native resolution
        const scaleX = width / pageCanvas.offsetWidth;
        const scaleY = height / pageCanvas.offsetHeight;
        const x = qrPosition.x * scaleX;
        const y = qrPosition.y * scaleY;
        const size = 80 * qrScale * scaleX; // QR size is 80 * qrScale
        ctx.drawImage(qrCanvasEl as HTMLCanvasElement, x, y, size, size);
      }
    }

    // Export combined canvas as image and create PDF at full resolution
    const imgData = combinedCanvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF({
      orientation: width > height ? "landscape" : "portrait",
      unit: "pt",
      format: [width, height],
      compress: false,
    });
    pdf.addImage(imgData, "PNG", 0, 0, width, height, undefined, "FAST");
    pdf.save(uploadedFileName);
  };

  return (
    <div className="app">
      <h1>PDF Upload & Preview</h1>
      <button onClick={handleUploadClick}>Upload PDF</button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <div style={{ margin: "16px 0" }}>
        <input
          type="text"
          placeholder="Enter URL for QR code"
          value={qrUrl}
          onChange={(e) => setQrUrl(e.target.value)}
        />
        <button onClick={() => setShowQr(true)} disabled={!qrUrl}>
          Generate QR & Overlay
        </button>
        <button onClick={() => setShowQr(false)} style={{ marginLeft: 8 }}>
          Remove QR
        </button>
      </div>
      <div style={{ margin: "16px 0" }}>
      
        <label style={{ marginLeft: 24 }}>
          QR Scale:&nbsp;
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={qrScale}
            onChange={e => setQrScale(Number(e.target.value))}
            style={{ width: 120 }}
          />
          &nbsp;{qrScale.toFixed(2)}x
        </label>
      </div>
      {pdfUrl && (
        <div
          ref={pdfContainerRef}
          style={{
            position: "relative",
            display: "inline-block",
            userSelect: dragging ? "none" : "auto",
            transformOrigin: "top left"
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
            <Page
              pageNumber={pageNumber}
              renderMode="canvas"
              renderTextLayer={false}
              renderAnnotationLayer={false}
              canvasBackground="white"
              // Use a custom canvas renderer to increase pixel density
              customTextRenderer={undefined}
              onRenderSuccess={undefined}
              width={undefined}
              height={undefined}
              // The following prop is not in react-pdf, but we can set devicePixelRatio globally
            />
          </Document>
          {showQr && qrUrl && (
            <div
              style={{
                position: "absolute",
                left: qrPosition.x,
                top: qrPosition.y,
                background: "white",
                padding: 4,
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                cursor: dragging ? "grabbing" : "grab",
                zIndex: 10,
                width: 80 * qrScale,
                height: 80 * qrScale,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onMouseDown={handleQrMouseDown}
            >
              <QRCodeCanvas value={qrUrl} size={80 * qrScale} />
            </div>
          )}
          <div style={{ marginTop: 8, textAlign: "center" }}>
            <button onClick={goToPrevPage} disabled={pageNumber <= 1}>
              Previous
            </button>
            <span style={{ margin: "0 12px" }}>
              Page {pageNumber} of {numPages}
            </span>
            <button onClick={goToNextPage} disabled={pageNumber >= numPages}>
              Next
            </button>
            <button onClick={handleSavePdf} style={{ marginLeft: 16 }}>
              Save PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Set devicePixelRatio for all canvases rendered by pdf.js to improve quality
if (typeof window !== "undefined") {
  window.devicePixelRatio = 2.0; // or even 3.0 for retina, but 2.0 is a good balance
}

export default App;