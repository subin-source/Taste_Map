import React, { useState, useEffect, useRef } from 'react';
import { Map, MapMarker } from 'react-kakao-maps-sdk';

function App() {
  const [stores, setStores] = useState(() => {
    const localData = localStorage.getItem('my-best-stores');
    return localData ? JSON.parse(localData) : [];
  });

  const [mapCenter, setMapCenter] = useState({ lat: 37.566826, lng: 126.9786567 });
  const mapRef = useRef(null);
  const [clickedPosition, setClickedPosition] = useState(null);
  const [openStoreId, setOpenStoreId] = useState(null);
  const [tempClickedStore, setTempClickedStore] = useState(null);

  const regions = ['서울', '경기도', '강원도', '충청도', '전라도', '경상도', '제주도'];
  const [selectedFilter, setSelectedFilter] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [newRegion, setNewRegion] = useState('서울');

  useEffect(() => {
    localStorage.setItem('my-best-stores', JSON.stringify(stores));
  }, [stores]);

  useEffect(() => {
    const handleResize = () => {
      const map = mapRef.current;
      if (map) {
        map.relayout();
        map.setCenter(new window.kakao.maps.LatLng(mapCenter.lat, mapCenter.lng));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapCenter]);

  // ⭐️ [핵심 추가] 마커 클릭 시 사이드바 리스트를 해당 위치로 스크롤하는 함수
  const scrollToSidebarItem = (storeId) => {
    // 조금의 시간차를 두어 UI가 먼저 렌더링되거나 열린 후 스크롤이 매끄럽게 동작하도록 합니다.
    setTimeout(() => {
      const element = document.getElementById(`store-card-${storeId}`);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth', // 부드럽게 스크롤 이동
          block: 'nearest'    // 스크롤 대상이 현재 뷰포트에 가장 가까운 곳에 멈추도록 설정
        });
      }
    }, 100);
  };

  const handleCardClick = (store) => {
    const map = mapRef.current;
    if (map) {
      const moveLatLon = new window.kakao.maps.LatLng(store.lat, store.lng);
      map.panTo(moveLatLon); 
    }
    setMapCenter({ lat: store.lat, lng: store.lng });
    setOpenStoreId(store.id);
    setTempClickedStore(null);
  };

  const matchRegion = (address) => {
    if (!address) return '서울';
    if (address.includes('서울')) return '서울';
    if (address.includes('경기')) return '경기도';
    if (address.includes('강원')) return '강원도';
    if (address.includes('충청') || address.includes('충북') || address.includes('충남') || address.includes('대전') || address.includes('세종')) return '충청도';
    if (address.includes('전라') || address.includes('전북') || address.includes('전남') || address.includes('광주')) return '전라도';
    if (address.includes('경상') || address.includes('경북') || address.includes('경남') || address.includes('부산') || address.includes('대구') || address.includes('울산')) return '경상도';
    if (address.includes('제주')) return '제주도';
    return '서울';
  };

  const handleMapClick = (_target, mouseEvent) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return;

    const latlng = mouseEvent.latLng;
    const lat = latlng.getLat();
    const lng = latlng.getLng();

    setClickedPosition({ lat, lng });
    setOpenStoreId(null);

    const ps = new window.kakao.maps.services.Places();
    const geocoder = new window.kakao.maps.services.Geocoder();

    ps.categorySearch('FD6', (data, status) => {
      if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
        const nearestStore = data[0];
        setSearchQuery(nearestStore.place_name);
        const fullAddress = nearestStore.road_address_name || nearestStore.address_name;
        
        setTempClickedStore({
          id: nearestStore.id,
          name: nearestStore.place_name,
          address: fullAddress,
          placeUrl: nearestStore.place_url,
          lat: parseFloat(nearestStore.y),
          lng: parseFloat(nearestStore.x),
        });
      } else {
        ps.categorySearch('CE7', (cafeData, cafeStatus) => {
          if (cafeStatus === window.kakao.maps.services.Status.OK && cafeData.length > 0) {
            const nearestCafe = cafeData[0];
            setSearchQuery(nearestCafe.place_name);
            const fullAddress = nearestCafe.road_address_name || nearestCafe.address_name;
            
            setTempClickedStore({
              id: nearestCafe.id,
              name: nearestCafe.place_name,
              address: fullAddress,
              placeUrl: nearestCafe.place_url,
              lat: parseFloat(nearestCafe.y),
              lng: parseFloat(nearestCafe.x),
            });
          } else {
            geocoder.coord2Address(lng, lat, (res, geoStatus) => {
              if (geoStatus === window.kakao.maps.services.Status.OK) {
                const addr = res[0].road_address ? res[0].road_address.address_name : res[0].address.address_name;
                setSearchQuery(addr);
                setTempClickedStore({
                  id: 'temp-addr',
                  name: '지정된 위치 (상호 없음)',
                  address: addr,
                  placeUrl: null,
                  lat: lat,
                  lng: lng,
                });
              }
            });
          }
        }, { location: latlng, radius: 30 });
      }
    }, {
      location: latlng,
      radius: 30,
      sort: window.kakao.maps.services.SortBy.DISTANCE
    });
  };

  const handleAddDirect = (targetStore) => {
    if (stores.some(store => store.id === targetStore.id)) {
      return alert('이미 맛집 리스트에 등록된 가게입니다!');
    }
    const autoDetectedRegion = matchRegion(targetStore.address);
    const newStore = {
      ...targetStore,
      region: autoDetectedRegion
    };
    setStores([...stores, newStore]);
    setMapCenter({ lat: targetStore.lat, lng: targetStore.lng });
    setSelectedFilter(autoDetectedRegion);
    setOpenStoreId(targetStore.id);
    setSearchQuery('');
    setTempClickedStore(null);
    setClickedPosition(null);
    // 등록 즉시 해당 리스트 아이템으로 포커싱 스크롤
    scrollToSidebarItem(targetStore.id);
  };

  const handleAddStore = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return alert('가게 이름이나 주소를 입력해주세요!');

    const ps = new window.kakao.maps.services.Places();
    ps.keywordSearch(searchQuery, (data, status) => {
      if (status === window.kakao.maps.services.Status.OK) {
        const firstPlace = data[0];
        const lat = parseFloat(firstPlace.y);
        const lng = parseFloat(firstPlace.x);

        if (stores.some(store => store.id === firstPlace.id)) {
          return alert('이미 맛집 리스트에 등록된 가게입니다!');
        }

        const finalAddress = firstPlace.road_address_name || firstPlace.address_name;
        const autoDetectedRegion = matchRegion(finalAddress);

        const isConfirm = confirm(`[${autoDetectedRegion}] '${firstPlace.place_name}' 장소에 핀을 추가하시겠습니까?`);
        if (!isConfirm) return;

        const newStore = {
          id: firstPlace.id,
          name: firstPlace.place_name,
          region: autoDetectedRegion,
          address: finalAddress,
          lat: lat,
          lng: lng,
          placeUrl: firstPlace.place_url 
        };

        setStores([...stores, newStore]);
        
        const map = mapRef.current;
        if (map) {
          map.panTo(new window.kakao.maps.LatLng(lat, lng));
        }
        setMapCenter({ lat, lng });
        setSelectedFilter(autoDetectedRegion);
        setOpenStoreId(firstPlace.id);

        setSearchQuery('');
        setClickedPosition(null);
        setTempClickedStore(null);
        // 등록 즉시 해당 리스트 아이템으로 포커싱 스크롤
        scrollToSidebarItem(firstPlace.id);
      } else {
        alert('검색된 장소가 없습니다.');
      }
    });
  };

  const handleDeleteStore = (id, e) => {
    e.stopPropagation(); 
    if (confirm('선택하신 맛집을 리스트와 지도에서 삭제하시겠습니까?')) {
      setStores(stores.filter(store => store.id !== id));
      if (openStoreId === id) setOpenStoreId(null);
    }
  };

  const filteredStores = selectedFilter === '전체' 
    ? stores 
    : stores.filter(store => store.region === selectedFilter);

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-gray-50 overflow-hidden select-none">
      
      {/* 🗺️ 지도 영역 */}
      <div className="w-full md:flex-1 h-[50vh] md:h-full md:order-2 shrink-0 border-b md:border-b-0 border-gray-200">
        <Map
          center={mapCenter}
          style={{ width: "100%", height: "100%" }}
          level={3}
          onClick={handleMapClick}
          ref={mapRef}
        >
          {/* 이미 등록된 맛집 마커들 */}
          {filteredStores.map((store) => (
            <MapMarker
              key={store.id}
              position={{ lat: store.lat, lng: store.lng }}
              clickable={true}
              onClick={() => {
                // ⭐️ 필터가 '전체'가 아니고 해당 지역과 다르면 강제로 필터를 변경하여 카드가 리스트에 뜨도록 유도
                if (selectedFilter !== '전체' && selectedFilter !== store.region) {
                  setSelectedFilter(store.region);
                }
                setOpenStoreId(store.id);
                setTempClickedStore(null);
                
                // ⭐️ 마커 클릭 시 리스트 자동 동기화 스크롤 작동
                scrollToSidebarItem(store.id);
              }}
            >
              {openStoreId === store.id && (
                <div className="p-3 min-w-[190px] max-w-[240px] bg-white rounded-lg shadow-md relative">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {store.region}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setOpenStoreId(null); }}
                      className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-0.5 truncate">{store.name}</h4>
                  <p className="text-[11px] text-gray-500 leading-tight mb-2 break-all">{store.address}</p>
                  {store.placeUrl && (
                    <a 
                      href={store.placeUrl} target="_blank" rel="noopener noreferrer"
                      className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] py-1.5 rounded transition shadow-sm"
                    >
                      상세정보 확인
                    </a>
                  )}
                </div>
              )}
            </MapMarker>
          ))}

          {/* 지도를 새로 클릭했을 때 나타나는 임시 별 마커 */}
          {clickedPosition && tempClickedStore && (
            <MapMarker 
              position={clickedPosition}
              image={{
                src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
                size: { width: 24, height: 35 }
              }}
              clickable={true}
            >
              <div className="p-3 min-w-[200px] max-w-[250px] bg-white rounded-lg shadow-md relative">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    탐색 중인 장소
                  </span>
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setTempClickedStore(null); 
                      setClickedPosition(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1"
                  >
                    ✕
                  </button>
                </div>
                <h4 className="text-sm font-bold text-gray-900 mb-0.5 truncate">{tempClickedStore.name}</h4>
                <p className="text-[11px] text-gray-500 leading-tight mb-2 break-all">{tempClickedStore.address}</p>
                
                <div className="flex gap-1">
                  {tempClickedStore.placeUrl && (
                    <a 
                      href={tempClickedStore.placeUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 text-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-[10px] py-1.5 rounded transition"
                    >
                      상세보기
                    </a>
                  )}
                  <button
                    onClick={() => handleAddDirect(tempClickedStore)}
                    className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold text-[10px] py-1.5 rounded transition shadow-sm"
                  >
                    내 지도에 등록
                  </button>
                </div>
              </div>
            </MapMarker>
          )}
        </Map>
      </div>

      {/* 📋 사이드바/리스트 영역 */}
      <div className="w-full md:w-1/3 bg-white px-4 pt-3 pb-2 md:p-6 shadow-xl z-10 h-[50vh] md:h-full flex flex-col md:order-1 overflow-hidden">
        
        {/* 상단 타이틀 및 백업 버튼 */}
        <div className="flex justify-between items-center mb-2 md:mb-4 shrink-0">
          <h1 className="text-lg md:text-2xl font-bold text-gray-800">나의 맛집 지도</h1>
          <div className="flex gap-1">
            <button
              onClick={() => {
                if (stores.length === 0) return alert("백업할 데이터가 없습니다.");
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stores));
                const dl = document.createElement('a');
                dl.setAttribute("href", dataStr);
                dl.setAttribute("download", `my-stores.json`);
                dl.click();
              }}
              className="bg-gray-100 active:bg-gray-200 text-gray-700 font-semibold px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs transition"
            >
              백업
            </button>
            <label className="bg-gray-100 active:bg-gray-200 text-gray-700 font-semibold px-2 py-0.5 md:py-1 rounded text-[10px] md:text-xs cursor-pointer transition">
              복구
              <input
                type="file" accept=".json" className="hidden"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (evt) => {
                    try {
                      const imported = JSON.parse(evt.target.result);
                      if (Array.isArray(imported)) {
                        const newStoresOnly = imported.filter(imp => !stores.some(ex => ex.id === imp.id));
                        if (newStoresOnly.length === 0) return alert("이미 모두 등록된 맛집입니다!");
                        if (confirm(`새로운 맛집 ${newStoresOnly.length}개를 합치시겠습니까?`)) {
                          setStores([...stores, ...newStoresOnly]);
                        }
                      }
                    } catch (err) { alert("오류가 발생했습니다."); }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>

        {/* 폼 레이아웃 */}
        <form onSubmit={handleAddStore} className="mb-2 md:mb-5 shrink-0 md:bg-gray-50 md:p-4 md:rounded-xl md:border md:border-gray-200 md:space-y-3">
          <div className="hidden md:flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-700">새 맛집 등록</h2>
            <span className="text-[11px] text-blue-600 font-medium">지도를 클릭하면 정보가 표시됩니다</span>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="가게 이름, 주소 또는 지도 클릭" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 p-2 border border-gray-200 rounded-lg bg-gray-50 md:bg-white text-xs md:text-sm focus:outline-blue-500"
            />
            <button type="submit" className="md:hidden bg-gray-800 active:bg-gray-900 text-white font-bold px-3.5 rounded-lg text-xs shrink-0">
              등록
            </button>
          </div>
          <button type="submit" className="hidden md:block w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg text-sm transition shadow-sm">
            마킹하기
          </button>
        </form>
        
        {/* 지역별 필터 버튼 */}
        <div className="mb-2 md:mb-5 shrink-0 md:border-t md:border-gray-100 md:pt-4">
          <h2 className="hidden md:block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">지역별 보기</h2>
          <div className="flex flex-row md:flex-wrap gap-1 md:gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none snap-x">
            <button
              onClick={() => { setSelectedFilter('전체'); setOpenStoreId(null); }}
              className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[11px] md:text-xs font-bold transition shrink-0 snap-start ${
                selectedFilter === '전체' ? 'bg-teal-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              전체 ({stores.length})
            </button>
            {regions.map(region => {
              const count = stores.filter(s => s.region === region).length;
              return (
                <button
                  key={region}
                  onClick={() => { setSelectedFilter(region); setOpenStoreId(null); }}
                  className={`px-2.5 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg text-[11px] md:text-xs font-bold transition shrink-0 snap-start ${
                    selectedFilter === region ? 'bg-teal-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {region} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* 맛집 리스트 영역 */}
        <div className="flex-1 overflow-y-auto space-y-1.5 md:space-y-3 pr-0.5 touch-pan-y">
          <div className="text-[10px] md:text-xs font-semibold text-gray-400 mb-1 sticky top-0 bg-white z-10 py-0.5">
            '{selectedFilter}' 맛집 목록 ({filteredStores.length}개)
          </div>
          {filteredStores.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-xs md:text-sm">이 지역에 등록된 맛집이 없습니다.</p>
          ) : (
            filteredStores.map((store) => (
              <div 
                // ⭐️ [중요] 스크롤 타겟팅을 위해 각 카드 엘리먼트에 고유한 id를 부여합니다.
                id={`store-card-${store.id}`}
                key={store.id}
                onClick={() => handleCardClick(store)}
                className={`rounded-lg md:rounded-xl border transition cursor-pointer flex justify-between items-center md:items-start ${
                  openStoreId === store.id 
                    ? 'border-blue-500 bg-blue-50/40 shadow-sm' 
                    : 'border-gray-100 bg-gray-50/50 hover:border-blue-300 active:bg-gray-100'
                } p-2.5 md:p-4`}
              >
                <div className="flex-1 min-w-0 pr-2 flex md:block items-center gap-2">
                  <span className="inline-block font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0 text-[9px] md:text-[10px] px-1.5 py-0.5">
                    {store.region.replace('도', '')}
                  </span>
                  <div className="min-w-0 flex-1 md:mt-1.5">
                    <h3 className="font-bold text-gray-900 truncate text-xs md:text-base lg:text-lg">{store.name}</h3>
                    <p className="text-gray-400 md:text-gray-500 truncate mt-0.5 text-[10px] md:text-xs break-all">{store.address}</p>
                  </div>
                </div>
                <button 
                  onClick={(e) => handleDeleteStore(store.id, e)}
                  className="text-gray-400 hover:text-red-500 font-medium p-1 transition shrink-0 text-[11px] md:text-xs"
                >
                  삭제
                </button>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

export default App;