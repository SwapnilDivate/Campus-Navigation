import React, { useEffect, useState } from "react";
import { MapContainer, ImageOverlay, GeoJSON, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const imageBounds = [
  [12.334565, 76.616730], 
  [12.338710, 76.62345]
];

const CampusMap = () => {
  const [geoData, setGeoData] = useState({ roads: null, buildings: null, points: null });
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [route, setRoute] = useState(null);
  const [adjacencyList, setAdjacencyList] = useState({});

  useEffect(() => {
    const loadGeoJSON = async (name) => {
      try {
        const response = await fetch(`/geojson/${name}.geojson`);
        if (!response.ok) throw new Error(`Failed to load ${name}`);
        return await response.json();
      } catch (error) {
        console.error(`Error loading ${name}:`, error);
        return null;
      }
    };

    Promise.all([
      loadGeoJSON("roads1"),
      loadGeoJSON("buildings1"),
      loadGeoJSON("points1"),
    ]).then(([roads, buildings, points]) => {
      setGeoData({ roads, buildings, points });

      if (roads) {
        const adjacency = buildAdjacencyList(roads);
        setAdjacencyList(adjacency);
      }
    });
  }, []);

  const buildAdjacencyList = (roads) => {
    let graph = {};
    roads.features.forEach((road) => {
      const coords = road.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      for (let i = 0; i < coords.length - 1; i++) {
        const key1 = JSON.stringify(coords[i]);
        const key2 = JSON.stringify(coords[i + 1]);

        if (!graph[key1]) graph[key1] = {};
        if (!graph[key2]) graph[key2] = {};

        const distance = L.latLng(coords[i]).distanceTo(coords[i + 1]);

        graph[key1][key2] = distance;
        graph[key2][key1] = distance;
      }
    });
    return graph;
  };

  const findNearestNode = (latlng) => {
    let nearest = null;
    let minDistance = Infinity;

    Object.keys(adjacencyList).forEach((node) => {
      const nodeCoords = JSON.parse(node);
      const distance = L.latLng(latlng).distanceTo(nodeCoords);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = node;
      }
    });

    return nearest;
  };

  const dijkstra = (start, end) => {
    if (!start || !end) return { path: null };

    let distances = {};
    let previous = {};
    let unvisited = new Set(Object.keys(adjacencyList));

    Object.keys(adjacencyList).forEach((node) => {
      distances[node] = Infinity;
      previous[node] = null;
    });

    distances[start] = 0;

    while (unvisited.size) {
      let current = Array.from(unvisited).reduce((minNode, node) =>
        distances[node] < distances[minNode] ? node : minNode
      );

      if (distances[current] === Infinity) break;
      if (current === end) break;

      unvisited.delete(current);

      Object.keys(adjacencyList[current]).forEach((neighbor) => {
        let alt = distances[current] + adjacencyList[current][neighbor];

        if (alt < distances[neighbor]) {
          distances[neighbor] = alt;
          previous[neighbor] = current;
        }
      });
    }

    let path = [];
    let step = end;
    while (step) {
      path.unshift(JSON.parse(step));
      step = previous[step];
    }

    return { path };
  };

  const handleNavigation = () => {
    if (!startPoint || !endPoint) return alert("Select both start and end points!");

    const startCoords = geoData.points.features.find(p => p.properties.name === startPoint)?.geometry.coordinates;
    const endCoords = geoData.points.features.find(p => p.properties.name === endPoint)?.geometry.coordinates;

    if (!startCoords || !endCoords) return alert("Invalid points selected!");

    const startNode = findNearestNode([startCoords[1], startCoords[0]]);
    const endNode = findNearestNode([endCoords[1], endCoords[0]]);

    if (!startNode || !endNode) return alert("Selected points are not connected to the road network!");

    const { path } = dijkstra(startNode, endNode);

    if (!path || path.length < 2) {
      alert("No valid path found between selected points.");
      setRoute(null);
    } else {
      setRoute(path);
    }
  };

  return (
    <div>
      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 1000, background: "white", padding: "10px" }}>
        <label>Start:</label>
        <select onChange={(e) => setStartPoint(e.target.value)}>
          <option value="">Select Start</option>
          {geoData.points &&
            geoData.points.features.map((p, index) => (
              <option key={index} value={p.properties.name}>
                {p.properties.name}
              </option>
            ))}
        </select>

        <label>End:</label>
        <select onChange={(e) => setEndPoint(e.target.value)}>
          <option value="">Select Destination</option>
          {geoData.points &&
            geoData.points.features.map((p, index) => (
              <option key={index} value={p.properties.name}>
                {p.properties.name}
              </option>
            ))}
        </select>

        <button onClick={handleNavigation}>Find Route</button>
      </div>

      <MapContainer center={[12.3365, 76.6195]} zoom={18} style={{ height: "100vh", width: "100%" }} crs={L.CRS.EPSG3857}>
        <ImageOverlay url="/map.jpg" bounds={imageBounds} />
        {geoData.roads && <GeoJSON data={geoData.roads} style={{ color: "blue", weight: 0 }} />}
        {geoData.buildings && <GeoJSON data={geoData.buildings} style={{ color: "gray", weight: 0, fillOpacity: 0 }} />}
        {geoData.points && <GeoJSON data={geoData.points} pointToLayer={(feature, latlng) =>
          L.circleMarker(latlng, {
            radius: 4,
            fillColor: "red",
            color: "#800000",
            weight: 0,
            opacity: 0,
            fillOpacity: 0,
          }).bindPopup(feature.properties.name)
        } />}
        {route && <Polyline positions={route} color="blue" weight={6} />}
      </MapContainer>
    </div>
  );
};

export default CampusMap;
