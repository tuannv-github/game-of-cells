import yaml from 'js-yaml';

export const loadMap = (yamlString) => {
    try {
        return yaml.load(yamlString);
    } catch (e) {
        console.error('Failed to parse YAML map:', e);
        return null;
    }
};

export const exportMap = (mapData) => {
    try {
        return yaml.dump(mapData);
    } catch (e) {
        console.error('Failed to export YAML map:', e);
        return null;
    }
};

export const convertGridToYaml = (levels, config) => {
    return {
        distance_between_levels: config.LEVEL_DISTANCE,
        levels: levels.map(l => ({
            id: l.id,
            cells: l.cells.map(c => ({
                id: c.id,
                type: c.type,
                center: { x: c.x, y: 0, z: c.z },
                radius: c.type === 'capacity' ? config.CAPACITY_CELL_RADIUS : config.COVERAGE_CELL_RADIUS
            }))
        }))
    };
};
