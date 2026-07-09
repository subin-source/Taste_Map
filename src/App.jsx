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

  const regions = ['서울', '경기도', '강원도', '충청도', '전라도', '경상도', '제주도'];
  const [selectedFilter, setSelectedFilter] = useState('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [newRegion, setNewRegion] = useState('서울');

  useEffect(() => {
    localStorage.setItem('my-best-stores', JSON.stringify(stores));
  }, [stores]);

  // ⭐️ [반응형 핵심 해결책] 화면 크기가 늘어나거나 줄어들 때 카카오맵 깨짐을 방지하는 효과
  useEffect(() => {
    const handleResize = () => {
      const map = mapRef.current;
      if (map) {
        // 카카오맵의 레이아웃을 재계산하여 다시 그립니다.
        map.relayout();
        // 화면 크기가 바뀌어도 원래 보고 있던 중심 좌표가 틀어지지 않게 고정합니다.
        map.setCenter(new window.kakao.maps.LatLng(mapCenter.lat, mapCenter.lng));
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapCenter]); // 중심 좌표가 바뀔 때마다 최신화된 크기 감지

  const handleCardClick = (store) => {
    const map = mapRef.current;
    if (map) {
      const moveLatLon = new window.kakao.maps.LatLng(store.lat, store.lng);
      map.panTo(moveLatLon); 
    }
    setMapCenter({ lat: store.lat, lng: store.lng });
    setOpenStoreId(store.id);

    if (window.innerWidth < 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        setNewRegion(matchRegion(fullAddress));
      } else {
        ps.categorySearch('CE7', (cafeData, cafeStatus) => {
          if (cafeStatus === window.kakao.maps.services.Status.OK && cafeData.length > 0) {
            const nearestCafe = cafeData[0];
            setSearchQuery(nearestCafe.place_name);
            const fullAddress = nearestCafe.road_address_name || nearestCafe.address_name;
            setNewRegion(matchRegion(fullAddress));
          } else {
            geocoder.coord2Address(lng, lat, (res, geoStatus) => {
              if (geoStatus === window.kakao.maps.services.Status.OK) {
                const addr = res[0].road_address ? res[0].road_address.address_name : res[0].address.address_name;
                setSearchQuery(addr);
                setNewRegion(matchRegion(addr));
              }
            });
          }
        }, { location: latlng, radius: 20 });
      }
    }, {
      location: latlng,
      radius: 20,
      sort: window.kakao.maps.services.SortBy.DISTANCE
    });
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
    // ⭐️ 모바일 전체 스크롤 꼬임 방지를 위해 md 미만에서는 고정 높이 대신 자연스러운 유연 스크롤(h-screen 오버라이드) 레이아웃 적용
    <div className="flex flex-col md:flex-row h-auto md:h-screen w-full bg-gray-50 overflow-y-auto md:overflow-hidden">
      
      {/* 지도 영역 (모바일 상단 고정 배치) */}
      {/* ⭐️ h-[40vh]~[50vh] 범위로 모바일 높이를 명시하고, shrink-0으로 감싸 지도가 찌그러지지 않게 방지합니다. */}
      <div className="w-full md:flex-1 h-[45vh] md:h-full min-h-[300px] md:order-2 shrink-0">
        <Map
          center={mapCenter}
          style={{ width: "100%", height: "100%" }}
          level={3}
          onClick={handleMapClick}
          ref={mapRef}
        >
          {filteredStores.map((store) => (
            <MapMarker
              key={store.id}
              position={{ lat: store.lat, lng: store.lng }}
              clickable={true}
              onClick={() => setOpenStoreId(store.id)}
            >
              {openStoreId === store.id && (
                <div className="p-3 min-w-[190px] max-w-[240px] bg-white rounded-lg shadow-md relative">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {store.region}
                    </span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenStoreId(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 text-xs font-bold px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mb-0.5 truncate">{store.name}</h4>
                  <p className="text-[11px] text-gray-500 leading-tight mb-2 break-all">{store.address}</p>
                  
                  {store.placeUrl && (
                    <a 
                      href={store.placeUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] py-1.5 rounded transition shadow-sm"
                    >
                      오픈시간 / 상세정보 확인
                    </a>
                  )}
                </div>
              )}
            </MapMarker>
          ))}

          {clickedPosition && (
            <MapMarker 
              position={clickedPosition}
              image={{
                src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
                size: { width: 24, height: 35 }
              }}
            />
          )}
        </Map>
      </div>

      {/* 사이드바 영역 (모바일 하단 배치) */}
      {/* ⭐️ md:order-1을 주어 PC에서는 왼쪽, 모바일에서는 지도 밑(하단)에 배치되도록 완벽히 통제합니다. */}
      <div className="w-full md:w-1/3 bg-white p-5 md:p-6 shadow-lg z-10 h-auto md:h-full overflow-y-visible md:overflow-y-auto flex flex-col md:order-1">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-4">맛집 지도</h1>
        
        {/* 지역별 필터 버튼 */}
        <div className="mb-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">지역별 보기</h2>
          <div className="flex flex-row md:flex-wrap gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => { setSelectedFilter('전체'); setOpenStoreId(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                    selectedFilter === region ? 'bg-teal-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {region} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* 맛집 추가 폼 */}
        <form onSubmit={handleAddStore} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-5 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-700">새 맛집 등록</h2>
            <span className="text-[10px] md:text-[11px] text-blue-600 font-medium">지도를 클릭해보세요</span>
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="가게 이름, 주소 또는 지도 클릭" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 p-2 border rounded-lg bg-white text-sm focus:outline-blue-500"
            />
          </div>
          <button type="submit" className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded-lg text-sm transition shadow-sm">
            마킹하기
          </button>
        </form>

        {/* 맛집 리스트 */}
        <div className="space-y-3 flex-1 md:overflow-y-auto pb-4">
          <div className="text-xs font-semibold text-gray-400 mb-2">
            '{selectedFilter}' 맛집 목록 ({filteredStores.length}개)
          </div>
          {filteredStores.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">이 지역에 등록된 맛집이 없습니다.</p>
          ) : (
            filteredStores.map((store) => (
              <div 
                key={store.id}
                onClick={() => handleCardClick(store)}
                className={`p-4 rounded-xl border transition cursor-pointer flex justify-between items-start ${
                  openStoreId === store.id 
                    ? 'border-blue-500 bg-blue-50/50' 
                    : 'border-gray-100 bg-gray-50 hover:border-blue-300'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {store.region}
                  </span>
                  <h3 className="text-base md:text-lg font-bold text-gray-900 mt-1.5 truncate">{store.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 break-all">{store.address}</p>
                </div>
                <button 
                  onClick={(e) => handleDeleteStore(store.id, e)}
                  className="text-xs text-gray-400 hover:text-red-500 font-medium p-1 transition shrink-0"
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