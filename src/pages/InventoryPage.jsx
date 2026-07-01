import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Scissors, Plus, History, PackageSearch, List, Search } from 'lucide-react';

export default function CuttingDashboard() {
  const [longBars, setLongBars] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form State for Execution
  const [selectedBarId, setSelectedBarId] = useState('');
  const [cutPieceName, setCutPieceName] = useState('');
  const [cutDimension, setCutDimension] = useState('');
  const [quantity, setQuantity] = useState('1');

  // Form State for Adding Long Bar
  const [newBarType, setNewBarType] = useState('');
  const [newBarLength, setNewBarLength] = useState('');
  
  // Form State for Defining Cut Piece
  const [newCutPieceName, setNewCutPieceName] = useState('');
  const [newCutPieceBarType, setNewCutPieceBarType] = useState('');
  const [newCutPieceDimension, setNewCutPieceDimension] = useState('');
  const [defineError, setDefineError] = useState(null);
  const [defineSuccess, setDefineSuccess] = useState(null);
  const [isBarTypeDropdownOpen, setIsBarTypeDropdownOpen] = useState(false);
  const [isCutPieceDropdownOpen, setIsCutPieceDropdownOpen] = useState(false);
  
  // Search State
  const [barSearch, setBarSearch] = useState('');
  const [pieceSearch, setPieceSearch] = useState('');

  // Fine Blank State
  const [fineBlanks, setFineBlanks] = useState([]);
  const [fineBlankInventory, setFineBlankInventory] = useState([]);
  const [fineBlankHistory, setFineBlankHistory] = useState([]);
  
  // Define Fine Blank Form
  const [newFbName, setNewFbName] = useState('');
  const [newFbParent, setNewFbParent] = useState('');
  const [newFbDim, setNewFbDim] = useState('');
  const [newFbMat, setNewFbMat] = useState('');
  const [newFbDesc, setNewFbDesc] = useState('');
  const [fbDefineError, setFbDefineError] = useState(null);
  const [fbDefineSuccess, setFbDefineSuccess] = useState(null);
  
  // Produce Fine Blank Form
  const [fbProdCutPieceId, setFbProdCutPieceId] = useState('');
  const [fbProdName, setFbProdName] = useState('');
  const [fbProdConsume, setFbProdConsume] = useState('');
  const [fbProdProduce, setFbProdProduce] = useState('');
  const [fbProdNotes, setFbProdNotes] = useState('');
  const [fbProdError, setFbProdError] = useState(null);
  const [fbProdSuccess, setFbProdSuccess] = useState(null);
  
  // Fine Blank Dropdowns
  const [isFbCutPieceDropdownOpen, setIsFbCutPieceDropdownOpen] = useState(false);
  const [isFbNameDropdownOpen, setIsFbNameDropdownOpen] = useState(false);
  const [fbSearch, setFbSearch] = useState('');


  const fetchData = async () => {
    try {
      
      const [barsRes, invRes, histRes, fbDefRes, fbInvRes, fbHistRes] = await Promise.all([
        fetch('/api/inventory/long-bars'),
        fetch('/api/inventory/stock'),
        fetch('/api/inventory/production-history'),
        fetch('/api/inventory/fine-blanks'),
        fetch('/api/inventory/fine-blank-stock'),
        fetch('/api/inventory/fine-blank-history'),
      ]);
      
      const bars = barsRes.ok ? await barsRes.json() : [];
      const inv = invRes.ok ? await invRes.json() : [];
      const hist = histRes.ok ? await histRes.json() : [];
      const fbDef = fbDefRes.ok ? await fbDefRes.json() : [];
      const fbInv = fbInvRes.ok ? await fbInvRes.json() : [];
      const fbHist = fbHistRes.ok ? await fbHistRes.json() : [];
      
      setLongBars(Array.isArray(bars) ? bars : []);
      setInventory(Array.isArray(inv) ? inv : []);
      setHistory(Array.isArray(hist) ? hist : []);
      setFineBlanks(Array.isArray(fbDef) ? fbDef : []);
      setFineBlankInventory(Array.isArray(fbInv) ? fbInv : []);
      setFineBlankHistory(Array.isArray(fbHist) ? fbHist : []);

    } catch (err) {
      console.error('Failed to fetch data:', err);
    }
  };

  useEffect(() => {
    // We wrap the initial call in a setTimeout to avoid synchronous setState warnings in some strict mode setups
    const timeout = setTimeout(() => {
      fetchData();
    }, 0);
    const interval = setInterval(fetchData, 5000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  
  const handleDefineFineBlank = async (e) => {
    e.preventDefault();
    setFbDefineError(null);
    setFbDefineSuccess(null);
    try {
      const res = await fetch('/api/inventory/fine-blanks/define', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fineBlankName: newFbName,
          parentCutPieceType: newFbParent,
          dimension: Number(newFbDim),
          material: newFbMat,
          description: newFbDesc
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to define Fine Blank');
      
      setFbDefineSuccess(data.message);
      setNewFbName(''); setNewFbParent(''); setNewFbDim(''); setNewFbMat(''); setNewFbDesc('');
      fetchData();
    } catch (err) {
      setFbDefineError(err.message);
    }
  };

  const handleProduceFineBlank = async (e) => {
    e.preventDefault();
    setFbProdError(null);
    setFbProdSuccess(null);
    try {
      const res = await fetch('/api/inventory/fine-blank/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cutPieceId: Number(fbProdCutPieceId),
          fineBlankName: fbProdName,
          consumedQty: Number(fbProdConsume),
          producedQty: Number(fbProdProduce),
          remarks: fbProdNotes,
          createdBy: 'Operator'
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to produce Fine Blank');
      
      setFbProdSuccess(data.message);
      setFbProdCutPieceId(''); setFbProdName(''); setFbProdConsume(''); setFbProdProduce(''); setFbProdNotes('');
      fetchData();
    } catch (err) {
      setFbProdError(err.message);
    }
  };


  const handleExecuteCut = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/inventory/cut-piece', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          longBarId: Number(selectedBarId),
          cutPieceName,
          cutDimension: Number(cutDimension),
          quantity: Number(quantity),
          createdBy: 'Operator',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Cut execution failed');
      
      setSuccess(`${data.message} Bar length: ${data.data.barLengthBefore}mm → ${data.data.barLengthAfter}mm`);
      fetchData(); // Refresh immediately
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddLongBar = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/inventory/long-bars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barType: newBarType,
          originalLength: Number(newBarLength),
        }),
      });
      if (res.ok) {
        setNewBarType('');
        setNewBarLength('');
        fetchData();
      }
    } catch (err) {
      console.error('Failed to add bar', err);
    }
  };

  const handleDefineCutPiece = async (e) => {
    e.preventDefault();
    setDefineError(null);
    setDefineSuccess(null);
    try {
      const res = await fetch('/api/inventory/cut-pieces/define', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cutPieceName: newCutPieceName,
          parentBarType: newCutPieceBarType,
          cutDimension: Number(newCutPieceDimension),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to define cut piece');
      
      setDefineSuccess(data.message);
      setNewCutPieceName('');
      setNewCutPieceBarType('');
      setNewCutPieceDimension('');
      fetchData();
    } catch (err) {
      setDefineError(err.message);
    }
  };

  const handleCutPieceSelect = (e) => {
    const selectedName = e.target.value;
    setCutPieceName(selectedName);
    const piece = inventory.find(inv => inv.cutPiece.cutPieceName === selectedName);
    if (piece) {
      setCutDimension(piece.cutPiece.cutDimension);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Active') return 'bg-[var(--glow2)] text-[var(--success)] border-[var(--success)]/20';
    if (status === 'Partial') return 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20';
    return 'bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20';
  };

  const getInventoryStatusColor = (qty, minThreshold) => {
    if (qty === 0) return 'text-[var(--danger)]';
    if (qty < minThreshold) return 'text-[var(--warning)]';
    return 'text-[var(--success)]';
  };

  const filteredLongBars = longBars.filter(bar => 
    bar.barType?.toLowerCase().includes(barSearch.toLowerCase()) || 
    String(bar.id).includes(barSearch)
  );

  const filteredInventory = inventory.filter(inv => 
    inv.cutPiece?.cutPieceName?.toLowerCase().includes(pieceSearch.toLowerCase()) ||
    inv.cutPiece?.parentBarType?.toLowerCase().includes(pieceSearch.toLowerCase())
  );

  const uniqueBarTypes = [...new Set(longBars.map(b => b.barType).filter(Boolean))];
  const filteredBarTypesForDropdown = uniqueBarTypes.filter(type => 
    type.toLowerCase().includes(newCutPieceBarType.toLowerCase())
  );

  const filteredCutPiecesForDropdown = inventory.filter(inv => 
    (inv.cutPiece?.cutPieceName || '').toLowerCase().includes((cutPieceName || '').toLowerCase())
  );

  const filteredFineBlanksForDropdown = fineBlanks.filter(fb => 
    fb.fine_blank_name.toLowerCase().includes((fbProdName || '').toLowerCase())
  );
  
  const filteredCutPiecesWithStock = inventory.filter(inv => 
    inv.quantityAvailable > 0 &&
    (inv.cutPiece?.cutPieceName || '').toLowerCase().includes((fbSearch || '').toLowerCase())
  );
  
  const filteredFineBlankInventory = fineBlankInventory.filter(inv => 
    inv.fineBlank?.fineBlankName?.toLowerCase().includes(pieceSearch.toLowerCase()) ||
    inv.fineBlank?.parentCutPieceType?.toLowerCase().includes(pieceSearch.toLowerCase()) ||
    String(inv.fineBlank?.dimension || '').includes(pieceSearch)
  );

  return (
    <div className="space-y-6">
      
      {/* Forms Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execute Cut Form */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[var(--danger)]/10 rounded-lg"><Scissors className="w-6 h-6 text-[var(--danger)]" /></div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Execute Cut Operation</h2>
          </div>
          
          <form onSubmit={handleExecuteCut} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Select Long Bar to Cut</label>
              <select 
                required
                value={selectedBarId}
                onChange={(e) => setSelectedBarId(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--danger)] outline-none"
              >
                <option value="">-- Select Active/Partial Bar --</option>
                {longBars.filter(b => b.status !== 'Depleted').map(bar => (
                  <option key={bar.id} value={bar.id}>
                    ID: {bar.id} | {bar.barType} (Available: {bar.currentLength}mm)
                  </option>
                ))}
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Select Cut Piece</label>
                <input 
                  type="text" 
                  required 
                  value={cutPieceName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCutPieceName(val);
                    setIsCutPieceDropdownOpen(true);
                    const piece = inventory.find(inv => inv.cutPiece.cutPieceName === val);
                    if (piece) {
                      setCutDimension(piece.cutPiece.cutDimension);
                    } else {
                      setCutDimension('');
                    }
                  }}
                  onFocus={() => setIsCutPieceDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsCutPieceDropdownOpen(false), 200)}
                  placeholder="Search or select cut piece..."
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--danger)] outline-none"
                />
                {isCutPieceDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCutPiecesForDropdown.map(inv => (
                      <div 
                        key={inv.id}
                        className="px-4 py-2 hover:bg-[var(--bg-bar-empty)] cursor-pointer text-[var(--text-primary)]"
                        onClick={() => {
                          setCutPieceName(inv.cutPiece.cutPieceName);
                          setCutDimension(inv.cutPiece.cutDimension);
                          setIsCutPieceDropdownOpen(false);
                        }}
                      >
                        {inv.cutPiece.cutPieceName} ({inv.cutPiece.cutDimension}mm)
                      </div>
                    ))}
                    {filteredCutPiecesForDropdown.length === 0 && (
                      <div className="px-4 py-2 text-[var(--text-muted)] text-sm">
                        No cut pieces found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Cut Dimension (mm)</label>
                <input 
                  type="number" required min="0.01" step="any" value={cutDimension} onChange={(e) => setCutDimension(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--danger)] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Quantity to Cut</label>
              <input 
                type="number" required min="0.01" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--danger)] outline-none"
              />
            </div>

            {error && (
              <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-[var(--glow2)] border border-[var(--success)]/20 text-[var(--success)] px-4 py-3 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{success}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={!selectedBarId || !cutPieceName || !cutDimension || !quantity}
              className="w-full bg-[var(--danger)] hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
            >
              <Scissors className="w-5 h-5" />
              EXECUTE CUT TRANSACTION
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-6">
          {/* Add Long Bar Utility */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-xl h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[var(--glow1)] rounded-lg"><Plus className="w-6 h-6 text-[var(--accent1)]" /></div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Receive New Long Bar</h2>
            </div>
            
            <form onSubmit={handleAddLongBar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Bar Type / Material</label>
                <input 
                  type="text" required value={newBarType} onChange={(e) => setNewBarType(e.target.value)}
                  placeholder="e.g. Steel Bar Type A"
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent1)] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Initial Length (mm)</label>
                <input 
                  type="number" required min="0.01" step="any" value={newBarLength} onChange={(e) => setNewBarLength(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent1)] outline-none"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-[var(--accent1)] hover:bg-[var(--accent2)] text-white font-bold py-2.5 rounded-lg transition-colors"
              >
                Add Long Bar to Inventory
              </button>
            </form>
          </div>

          {/* Define New Cut Piece Utility */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-xl h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[var(--glow2)] rounded-lg"><PackageSearch className="w-6 h-6 text-[var(--success)]" /></div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Define New Cut Piece</h2>
            </div>
            
            <form onSubmit={handleDefineCutPiece} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Cut Piece Name</label>
                <input 
                  type="text" required value={newCutPieceName} onChange={(e) => setNewCutPieceName(e.target.value)}
                  placeholder="e.g. 55 dia"
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--success)] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Parent Bar Type</label>
                  <input 
                    type="text" required value={newCutPieceBarType} 
                    onChange={(e) => {
                      setNewCutPieceBarType(e.target.value);
                      setIsBarTypeDropdownOpen(true);
                    }}
                    onFocus={() => setIsBarTypeDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsBarTypeDropdownOpen(false), 200)}
                    placeholder="Search or enter bar type..."
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--success)] outline-none"
                  />
                  {isBarTypeDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredBarTypesForDropdown.map((type, idx) => (
                        <div 
                          key={idx}
                          className="px-4 py-2 hover:bg-[var(--bg-bar-empty)] cursor-pointer text-[var(--text-primary)]"
                          onClick={() => {
                            setNewCutPieceBarType(type);
                            setIsBarTypeDropdownOpen(false);
                          }}
                        >
                          {type}
                        </div>
                      ))}
                      {filteredBarTypesForDropdown.length === 0 && (
                        <div className="px-4 py-2 text-[var(--text-muted)] text-sm">
                          {newCutPieceBarType ? 'Press enter to use custom type' : 'No types found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Dimension (mm)</label>
                  <input 
                    type="number" required min="0.01" step="any" value={newCutPieceDimension} onChange={(e) => setNewCutPieceDimension(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--success)] outline-none"
                  />
                </div>
              </div>

              {defineError && (
                <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{defineError}</p>
                </div>
              )}
              
              {defineSuccess && (
                <div className="bg-[var(--glow2)] border border-[var(--success)]/20 text-[var(--success)] px-4 py-3 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{defineSuccess}</p>
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-[var(--success)] hover:opacity-80 text-white font-bold py-2.5 rounded-lg transition-colors"
              >
                Save Cut Piece to Inventory (0 qty)
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Fine Blank Forms Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Execute Fine Blank Production */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[var(--danger)]/10 rounded-lg"><Scissors className="w-6 h-6 text-[var(--danger)]" /></div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Fine Blank Production</h2>
          </div>
          
          <form onSubmit={handleProduceFineBlank} className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Select Cut Piece</label>
              <input 
                type="text" 
                required 
                value={fbSearch}
                onChange={(e) => {
                  setFbSearch(e.target.value);
                  setIsFbCutPieceDropdownOpen(true);
                }}
                onFocus={() => setIsFbCutPieceDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsFbCutPieceDropdownOpen(false), 200)}
                placeholder="Search or select cut piece..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--danger)] outline-none"
              />
              {isFbCutPieceDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredCutPiecesWithStock.map(inv => (
                    <div 
                      key={inv.id}
                      className="px-4 py-2 hover:bg-[var(--bg-bar-empty)] cursor-pointer text-[var(--text-primary)]"
                      onClick={() => {
                        setFbProdCutPieceId(inv.cutPiece.id);
                        setFbSearch(inv.cutPiece.cutPieceName);
                        setIsFbCutPieceDropdownOpen(false);
                      }}
                    >
                      {inv.cutPiece.cutPieceName} (Stock: {inv.quantityAvailable})
                    </div>
                  ))}
                  {filteredCutPiecesWithStock.length === 0 && (
                    <div className="px-4 py-2 text-[var(--text-muted)] text-sm">
                      No cut pieces in stock
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Fine Blank Name</label>
              <input 
                type="text" 
                required 
                value={fbProdName}
                onChange={(e) => {
                  setFbProdName(e.target.value);
                  setIsFbNameDropdownOpen(true);
                }}
                onFocus={() => setIsFbNameDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsFbNameDropdownOpen(false), 200)}
                placeholder="Search or select fine blank..."
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--danger)] outline-none"
              />
              {isFbNameDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredFineBlanksForDropdown.map(fb => (
                    <div 
                      key={fb.id}
                      className="px-4 py-2 hover:bg-[var(--bg-bar-empty)] cursor-pointer text-[var(--text-primary)]"
                      onClick={() => {
                        setFbProdName(fb.fine_blank_name);
                        setIsFbNameDropdownOpen(false);
                      }}
                    >
                      {fb.fine_blank_name}
                    </div>
                  ))}
                  {filteredFineBlanksForDropdown.length === 0 && (
                    <div className="px-4 py-2 text-[var(--text-muted)] text-sm">
                      No fine blanks found
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Quantity to Consume</label>
                <input 
                  type="number" required min="1" step="any" value={fbProdConsume} onChange={(e) => setFbProdConsume(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--danger)] outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Quantity Produced</label>
                <input 
                  type="number" required min="1" step="any" value={fbProdProduce} onChange={(e) => setFbProdProduce(e.target.value)}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--danger)] outline-none"
                />
              </div>
            </div>



            {fbProdError && (
              <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{fbProdError}</p>
              </div>
            )}
            
            {fbProdSuccess && (
              <div className="bg-[var(--glow2)] border border-[var(--success)]/20 text-[var(--success)] px-4 py-3 rounded-lg flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{fbProdSuccess}</p>
              </div>
            )}

            <button 
              type="submit"
              disabled={!fbProdCutPieceId || !fbProdName || !fbProdConsume || !fbProdProduce}
              className="w-full bg-[var(--danger)] hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2"
            >
              <Scissors className="w-5 h-5" />
              Convert To Fine Blank
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-6">
          {/* Define Fine Blank Utility */}
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-6 shadow-xl h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-[var(--glow2)] rounded-lg"><PackageSearch className="w-6 h-6 text-[var(--success)]" /></div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Define New Fine Blank</h2>
            </div>
            
            <form onSubmit={handleDefineFineBlank} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Fine Blank Name</label>
                <input 
                  type="text" required value={newFbName} onChange={(e) => setNewFbName(e.target.value)}
                  placeholder="e.g. Fine Blank EN31"
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--success)] outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Parent Cut Piece Type</label>
                  <input 
                    type="text" required value={newFbParent} onChange={(e) => setNewFbParent(e.target.value)}
                    placeholder="e.g. cut piece dia 10"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--success)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] mb-1">Dimension (mm)</label>
                  <input 
                    type="number" required min="0.01" step="any" value={newFbDim} onChange={(e) => setNewFbDim(e.target.value)}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--success)] outline-none"
                  />
                </div>
              </div>


              {fbDefineError && (
                <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 text-[var(--danger)] px-4 py-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{fbDefineError}</p>
                </div>
              )}
              
              {fbDefineSuccess && (
                <div className="bg-[var(--glow2)] border border-[var(--success)]/20 text-[var(--success)] px-4 py-3 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{fbDefineSuccess}</p>
                </div>
              )}

              <button 
                type="submit"
                disabled={!newFbName || !newFbParent || !newFbDim}
                className="w-full bg-[var(--success)] hover:opacity-80 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-colors"
              >
                Save Fine Blank
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Dynamic Data Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Long Bars Panel */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xl">
          <div className="bg-[var(--bg-card2)] border-b border-[var(--border)] p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <List className="w-5 h-5 text-[var(--text-muted)]" />
              <h3 className="font-semibold text-[var(--text-primary)]">Available Long Bars</h3>
            </div>
          </div>
          <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-bar-empty)]">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search by ID or Bar Type..." 
                value={barSearch}
                onChange={(e) => setBarSearch(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--accent1)] outline-none"
              />
            </div>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {filteredLongBars.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-4">No long bars match your search</p>
              ) : filteredLongBars.map(bar => (
                <div key={bar.id} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{bar.barType}</div>
                    <div className="text-sm text-[var(--text-muted)]">ID: {bar.id} | Origin: {bar.originalLength}mm</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-[var(--text-primary)]">{bar.currentLength}mm</div>
                      <div className="text-xs text-[var(--text-muted)]">remaining</div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(bar.status)}`}>
                      {bar.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cut Pieces Inventory Panel */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xl">
          <div className="bg-[var(--bg-card2)] border-b border-[var(--border)] p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageSearch className="w-5 h-5 text-[var(--text-muted)]" />
              <h3 className="font-semibold text-[var(--text-primary)]">Cut Pieces Inventory</h3>
            </div>
          </div>
          <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-bar-empty)]">
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search by Piece Name or Parent Bar..." 
                value={pieceSearch}
                onChange={(e) => setPieceSearch(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--success)] outline-none"
              />
            </div>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {filteredInventory.length === 0 ? (
                <p className="text-[var(--text-muted)] text-sm text-center py-4">No cut pieces match your search</p>
              ) : filteredInventory.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)]">
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{inv.cutPiece.cutPieceName}</div>
                    <div className="text-sm text-[var(--text-muted)]">Dimension: {inv.cutPiece.cutDimension}mm | From: {inv.cutPiece.parentBarType}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-xl ${getInventoryStatusColor(inv.quantityAvailable, inv.cutPiece.minStockThreshold)}`}>
                      {inv.quantityAvailable}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">in stock</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fine Blank Inventory */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xl mt-6">
        <div className="bg-[var(--bg-card2)] border-b border-[var(--border)] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageSearch className="w-5 h-5 text-[var(--text-muted)]" />
            <h3 className="font-semibold text-[var(--text-primary)]">Fine Blank Inventory</h3>
          </div>
        </div>
        <div className="p-3 border-b border-[var(--border)] bg-[var(--bg-bar-empty)]">
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by Fine Blank, Parent, Dimension..." 
              value={fbSearch}
              onChange={(e) => setFbSearch(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--success)] outline-none"
            />
          </div>
        </div>
        <div className="p-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-3">
            {filteredFineBlankInventory.length === 0 ? (
              <p className="text-[var(--text-muted)] text-sm text-center py-4">No fine blanks match your search</p>
            ) : filteredFineBlankInventory.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] hover:border-[var(--danger)]/30 transition-colors">
                <div>
                  <div className="font-medium text-[var(--text-primary)]">{inv.fineBlank.fineBlankName}</div>
                  <div className="text-sm text-[var(--text-muted)]">Dim: {inv.fineBlank.dimension}mm | Parent: {inv.fineBlank.parentCutPieceType} | Mat: {inv.fineBlank.material}</div>
                </div>
                <div className="text-right">
                  <div className={"font-bold text-xl " + getInventoryStatusColor(Number(inv.quantityAvailable), 20)}>
                    {Number(inv.quantityAvailable).toFixed(2)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">in stock</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Production History Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xl">
        <div className="bg-[var(--bg-card2)] border-b border-[var(--border)] p-4 flex items-center gap-2">
          <History className="w-5 h-5 text-[var(--text-muted)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Recent Production History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--text-muted)]">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Long Bar</th>
                <th className="px-6 py-3 font-medium">Cut Piece</th>
                <th className="px-6 py-3 font-medium">Dimension</th>
                <th className="px-6 py-3 font-medium text-right">Length Before</th>
                <th className="px-6 py-3 font-medium text-right">Length After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-[var(--text-muted)]">No production logs found</td>
                </tr>
              ) : history.map(log => (
                <tr key={log.id} className="hover:bg-[var(--bg-bar-empty)] transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-3">{log.longBar?.barType} (ID: {log.longBar?.id})</td>
                  <td className="px-6 py-3">{log.cutPiece?.cutPieceName}</td>
                  <td className="px-6 py-3">{log.cutDimension}mm</td>
                  <td className="px-6 py-3 text-right text-[var(--text-secondary)]">{log.barLengthBefore}mm</td>
                  <td className="px-6 py-3 text-right text-[var(--danger)] font-medium">{log.barLengthAfter}mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fine Blank Production History Table */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xl mt-6">
        <div className="bg-[var(--bg-card2)] border-b border-[var(--border)] p-4 flex items-center gap-2">
          <History className="w-5 h-5 text-[var(--text-muted)]" />
          <h3 className="font-semibold text-[var(--text-primary)]">Fine Blank Production History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-[var(--text-muted)]">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-muted)] uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Cut Piece</th>
                <th className="px-6 py-3 font-medium">Fine Blank</th>
                <th className="px-6 py-3 font-medium text-right">Consumed Qty</th>
                <th className="px-6 py-3 font-medium text-right">Produced Qty</th>
                <th className="px-6 py-3 font-medium text-right">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {fineBlankHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-4 text-center text-[var(--text-muted)]">No fine blank production logs found</td>
                </tr>
              ) : fineBlankHistory.map(log => (
                <tr key={log.id} className="hover:bg-[var(--bg-bar-empty)] transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-3">{log.cutPiece?.cutPieceName}</td>
                  <td className="px-6 py-3">{log.fineBlank?.fineBlankName}</td>
                  <td className="px-6 py-3 text-right text-[var(--danger)] font-medium">{Number(log.consumedQty).toFixed(2)}</td>
                  <td className="px-6 py-3 text-right text-[var(--success)] font-medium">{Number(log.producedQty).toFixed(2)}</td>
                  <td className="px-6 py-3 text-right text-[var(--text-secondary)]">{log.remarks || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
