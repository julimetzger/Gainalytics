import {LineValue} from "react-native-charts-wrapper";
import {sumBy} from "lodash";

export function generateTrend(map: LineValue[]): LineValue[] {
    if (map.length > 2) {
        let n = map.length;
        let a = (n * sumBy(map, value => value.x!! * value.y) - sumBy(map, value => value.x!!) * sumBy(map, value => value.y)) / (n * sumBy(map, value => value.x!! * value.x!!) - sumBy(map, value => value.x!!) ** 2);
        let b = (sumBy(map, value => value.y) - a * sumBy(map, value => value.x!!)) / n;
        let firstPointy = a * map[0].x!! + b;
        let firstPoint = {x: map[0].x!!, y: firstPointy};
        let secondPointy = a * map[n - 1].x!! + b;
        let secondPoint = {x: map[n - 1].x!!, y: secondPointy};
        return [firstPoint, secondPoint];
    }
    return [];
}
